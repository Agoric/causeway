// This file is a copy of the root file, moved to the tools directory for better organization

// Original content from insertLogsIntoNeo4jCore.js
// pseudo-code and example (not fully tested)

// Imports
import { fs } from 'zx'; // or const fs = require('fs');
import { pipeline } from 'stream';
import { promisify } from 'util';
import neo4j from 'neo4j-driver';

const pipelineAsync = promisify(pipeline);

// Connect to Neo4j
const driver = neo4j.driver(
  'bolt://localhost:7687', 
  neo4j.auth.basic('neo4j', 'secretpassword')
);

// Step 1: Read lines as JSON
// Reads and parses JSON lines from a data stream
async function* readJSONLines(data) {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    // Process complete lines from buffer
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      yield JSON.parse(line);
      buf = buf.slice(pos + 1);
    }
  }
}

// Step 2: Process logs into graph updates
async function* processSlogEntries(entries) {
  // Data structures (similar to original code)
  const vatInfo = new Map();   // vatID -> { vatID, name? }
  let currentBlockHeight = undefined;
  let currentBlockTime = undefined;
  
  // We'll maintain a session for batching queries
  const session = driver.session();

  try {
    for await (const entry of entries) {
      const { type, vatID, time } = entry;
      switch (type) {
        case 'create-vat': {
          vatInfo.set(vatID, entry);
          // Ensure Vat node exists
          yield {
            query: `
              MERGE (v:Vat {vatID: $vatID})
              ON CREATE SET v.name = $name, v.createdTime = $time
            `,
            params: {
              vatID,
              name: entry.name || 'unknown',
              time: entry.time
            }
          };
          break;
        }
        case 'cosmic-swingset-end-block-start': {
          currentBlockHeight = entry.blockHeight;
          currentBlockTime = entry.blockTime;
          // Ensure Block node exists
          yield {
            query: `
              MERGE (b:Block {height: $height})
              ON CREATE SET m.name = $height, b.blockTime = $blockTime
            `,
            params: {
              height: currentBlockHeight,
              blockTime: currentBlockTime
            }
          };
          break;
        }
        case 'deliver': {
          // 'deliver' events represent incoming messages to a vat.
          // Extract message details
          const { kd } = entry;
          let method, target, argSize, senderRef;
          if (kd?.[0] === 'message') {
            const [
              _tag,
              targetRef,
              { methargs: { body }, result }
            ] = kd;
            const jsonString = body.startsWith('#') ? body.slice(1) : body;
            [method] = JSON.parse(jsonString);
            target = targetRef;
            argSize = body.length;
            senderRef = result; // This identifies who sent it if we can link back
          } else if (kd?.[0] === 'notify') {
            // For now, just handle message deliveries
            // notify might be different logic
            // skip or handle similarly
          }

          // Create Message node
          const messageId = `${method}-${vatID}-${entry.crankNum}-${entry.deliveryNum}`;
          yield {
            query: `
              MERGE (m:Message {id: $msgId})
              ON CREATE SET m.name = $msgId, m.time = $time, m.method = $method, m.crankNum = $crankNum, m.deliveryNum = $deliveryNum
            `,
            params: {
              msgId: messageId,
              time,
              method: method || 'unknownMethod',
              crankNum: entry.crankNum,
              deliveryNum: entry.deliveryNum
            }
          };

          // Link Message to Vat receiver
          yield {
            query: `
              MATCH (v:Vat {vatID: $vatID}), (m:Message {id: $msgId})
              MERGE (m)-[:RECEIVED_BY]->(v)
            `,
            params: {
              vatID,
              msgId: messageId
            }
          };

          // Link Message to Block
          if (currentBlockHeight !== undefined) {
            yield {
              query: `
                MATCH (b:Block {height: $height}), (m:Message {id: $msgId})
                MERGE (b)-[:CONTAINS]->(m)
              `,
              params: {
                height: currentBlockHeight,
                msgId: messageId
              }
            };
          }

          // We will attempt to link sender in syscall events
          // so for now we just have a message node ready.
          break;
        }
        case 'syscall': {
          // syscalls represent outgoing calls from a vat. If it's a 'send':
          // Example ksc: ['send', target, {method, result}]
          const { ksc } = entry;
          if (ksc && ksc[0] === 'send') {
            const [, target, { method, result }] = ksc;
            
            // We know the source vatID is calling out.
            // We must link the previously created message (if identified by `result`) back to its sender.
            // If we have `result` as a message id, we can link them.

            // Create or find a Message node again, just to be safe:
            const messageId = `${method}-${entry.time}-${entry.vatID}`;
            yield {
              query: `
                MERGE (m:Message {id: $msgId})
                ON CREATE SET m.name = $msgId, m.time = $time, m.method = $method
              `,
              params: {
                msgId: messageId,
                time,
                method: method || 'unknownMethod',
              }
            };

            // Link source vat
            yield {
              query: `
                MATCH (v:Vat {vatID: $vatID}), (m:Message {id: $msgId})
                MERGE (v)-[:SENT]->(m)
              `,
              params: {
                vatID,
                msgId: messageId
              }
            };
            
            // Linking to target vat is trickier because we might not have a deliver event yet.
            // But we have a target reference. If the target is a vat, we can link after it's created.
            // For now, just wait until a deliver event clarifies the receiver.
          }
          break;
        }
        default:
          // Unknown type or types we don't handle yet
          // Just skip
          break;
      }
    }
  } finally {
    await session.close();
  }
}

// Step 3: Main function to execute pipeline
export async function insertLogsIntoNeo4j({ inputFile }) {
  const inputStream = fs.createReadStream(inputFile, { encoding: 'utf-8' });
  
  const session = driver.session();
  const tx = session.beginTransaction();

  try {
    // We'll run queries in batches for efficiency
    const batchSize = 50;
    let batch = [];

    // We do not use pipelineAsync here since these are async generators, not streams
    for await (const operation of processSlogEntries(readJSONLines(inputStream))) {
      // `operation` contains your query and params for Neo4j
      await tx.run(operation.query, operation.params);
    }

    // Execute any leftover operations
    if (batch.length > 0) {
      await executeBatch(tx, batch);
    }

    await tx.commit();
  } catch (err) {
    console.error('Error:', err);
    await tx.rollback();
  } finally {
    await session.close();
    await driver.close();
  }
}

// Helper to execute a batch of queries
async function executeBatch(tx, operations) {
  for (const { query, params } of operations) {
    await tx.run(query, params);
  }
  operations.length = 0;
}

// To run:
// insertLogsIntoNeo4j({ inputFile: 'path/to/slog.jsonl' });