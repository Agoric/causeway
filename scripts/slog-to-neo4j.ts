#!/usr/bin/env ts-node
import { Driver, Session } from 'neo4j-driver';
import fs from 'fs';
import { processSlogEntries, readJSONLines } from './slog-utils';
import { SlogData } from '../app/types';
import driver from '../lib/neo4j';

class Metrics {
  processedBlocks: number;
  processedDeliveries: number;
  processedSyscalls: number;
  failedBatches: number;
  startTime: number;
  constructor() {
    this.reset();
  }

  reset() {
    this.processedBlocks = 0;
    this.processedDeliveries = 0;
    this.processedSyscalls = 0;
    this.failedBatches = 0;
    this.startTime = Date.now();
  }

  logStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(
      `\nProcessing Statistics:\n- Blocks processed: ${
        this.processedBlocks
      }\n- Deliveries processed: ${
        this.processedDeliveries
      }\n- Syscalls processed: ${this.processedSyscalls}\n- Failed batches: ${
        this.failedBatches
      }\n- Total time: ${elapsed.toFixed(2)}s`
    );
  }
}

const metrics = new Metrics();

/**
 * Sets up database schema, constraints, and indexes
 */
const setupSchema = async (session: Session) => {
  const indexes = [
    `CREATE INDEX delivery_id IF NOT EXISTS
     FOR (d:Delivery) ON (d.crankNum)`,

    `CREATE INDEX delivery_time IF NOT EXISTS
     FOR (d:Delivery) ON (d.timestamp)`,

    `CREATE INDEX object_ref IF NOT EXISTS
     FOR (o:Object) ON (o.kref)`,
  ];

  for (const index of indexes) {
    await session.run(index);
  }
};

const generateNeo4jGraph = async (data: SlogData, session: Session) => {
  const { vats, deliveries, syscalls, blocks } = data;

  // Create Vat nodes
  for (const vat of vats) {
    await session.run(
      `MERGE (v:Vat {vatID: $vatID})
       SET v.name = $name, v.createdAt = $time`,
      { vatID: vat.vatID, name: vat.name, time: vat.time }
    );
  }

  // Create Block nodes
  for (const block of blocks) {
    await session.run(
      `MERGE (b:Block {height: $height})
       SET b.time = $time, b.blockTime = $blockTime`,
      { height: block.height, time: block.time, blockTime: block.blockTime }
    );
  }

  // Create Message deliveries as nodes and relationships
  for (const msg of deliveries) {
    if (msg.type === 'notify') {
      await session.run(
        `CREATE (n:Notify {method: $method, time: $time, kpid: $kpid, blockHeight: $blockHeight})
         WITH n
         MATCH (v:Vat {vatID: $vatID})
         MATCH (m:Message {result: $kpid})
         CREATE (v)-[:CALLED_BY{object: $kpid}]->(m)
         CREATE (n)-[:CALL{object: $kpid, method: $method, call: $call }]->(v)`,
        {
          method: msg.state || 'unknown',
          time: msg.time,
          vatID: msg.vatID,
          kpid: msg.kpid || null,
          call: `${msg.kpid}->${msg.state}()`,
          blockHeight: msg.blockHeight || null,
        }
      );
    }
    if (msg.type === 'message') {
      await session.run(
        `CREATE (m:Message {method: $method, time: $time, crankNum: $crankNum, target: $target, result: $result, blockHeight: $blockHeight})
         WITH m
         MATCH (v:Vat {vatID: $vatID})
         CREATE (m)-[:CALL{object: $target, method: $method, call: $call }]->(v)`,
        {
          method: msg.method || 'unknown',
          time: msg.time,
          crankNum: msg.crankNum || null,
          vatID: msg.vatID,
          target: msg.target || null,
          result: msg.result || null,
          call: `${msg.target}->${msg.method}()`,
          blockHeight: msg.blockHeight || null,
        }
      );
    }
  }

  // Create Syscalls and relationships
  for (const syscall of syscalls) {
    if (syscall.type === 'send') {
      await session.run(
        `CREATE (s:Syscall {method: $method, time: $time, result: $result, target: $target, rejected: $rejected})
         WITH s
         MATCH (v:Vat {vatID: $vatID})
         CREATE (s)-[:SYSCALL_FROM]->(v)`,
        {
          method: syscall.method || 'unknown',
          result: syscall.result || null,
          time: syscall.time,
          vatID: syscall.vatID,
          target: syscall.target || 'unknown',
          rejected: syscall.rejected || 'false',
        }
      );
    }
  }

  // Create promise nodes and relationships
  for (const promise of data.promises) {
    await session.run(
      `MATCH (c:Vat {vatID: $creator})
       MATCH (n:Notify {kpid: $kpid})
       CREATE (n)-[:CALLED_BY]->(c)`,
      {
        kpid: promise.kpid || 'unknown',
        creator: promise.creator || 'unknown',
        resolver: promise.resolver || 'unknown',
      }
    );
  }
};

/**
 * Process a single log file
 */
const processFileForNeo4j = async (slogfileName: string, driver: Driver) => {
  console.log(`Processing ${slogfileName} for Neo4j`);
  const session = driver.session();

  let inputStream = fs.createReadStream(slogfileName, { encoding: 'utf-8' });

  const entries = readJSONLines(inputStream);
  const diagramData = await processSlogEntries(entries);

  await generateNeo4jGraph(diagramData, session);

  console.log('Diagram data:', diagramData);
};

const run = async () => {
  const [_node, _script, ...slogfileNames] = process.argv;

  if (slogfileNames.length === 0) {
    console.log('Usage: node processSlogs.js slogFile...');
    process.exit(64);
  }

  if (!driver) {
    throw new Error('Failed to connect to Neo4j. Driver is not defined.');
  }
  let session;

  try {
    session = driver.session();
    await setupSchema(session);
    await session.close();

    for (const slogfileName of slogfileNames) {
      console.log(`\nProcessing file: ${slogfileName}`);
      await processFileForNeo4j(slogfileName, driver);
    }

    console.log('\nProcessing completed!');
    metrics.logStats();
  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  } finally {
    if (session) await session.close();
    await driver.close();
    console.log('Database connections closed');
  }
};

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

run().catch((error) => {
  console.error('Error in main execution:', error);
  process.exit(1);
});
