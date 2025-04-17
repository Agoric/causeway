// This file is a copy of the root file, moved to the tools directory for better organization

// Original content from slog2neo4j.js
import fs from 'fs';
import path from 'path';
import neo4j from 'neo4j-driver';
import { fileURLToPath } from 'url';
import { processSlogEntries } from './processSlogSvg.js';

// Neo4j configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'secretpassword';

/**
 * Connect to Neo4j database and return driver
 */
async function connectToNeo4j() {
  try {
    const driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
    );
    
    // Test connection
    await driver.verifyConnectivity();
    console.log('Connected to Neo4j database');
    return driver;
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    throw error;
  }
}

/**
 * Read lines from a file and parse as JSON
 */
async function* readJSONLinesFromFile(filePath) {
  // Create read stream for input file
  let inputStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  
  // Handle gzipped files
  if (filePath.endsWith('.gz')) {
    inputStream = inputStream.pipe(zlib.createGunzip());
  }
  
  let buf = '';
  for await (const chunk of inputStream) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      try {
        yield JSON.parse(line);
      } catch (err) {
        console.warn('Error parsing JSON line:', err);
      }
      buf = buf.slice(pos + 1);
    }
  }
}

/**
 * Generate Neo4j graph from processed slog data
 */
async function createNeo4jGraph(data, driver) {
  const session = driver.session();
  
  try {
    // Create schema constraints and indexes
    const constraints = [
      `CREATE CONSTRAINT vat_id IF NOT EXISTS FOR (v:Vat) REQUIRE v.vatID IS UNIQUE`,
      `CREATE CONSTRAINT block_id IF NOT EXISTS FOR (b:Block) REQUIRE b.height IS UNIQUE`
    ];
    
    for (const constraint of constraints) {
      try {
        await session.run(constraint);
      } catch (err) {
        console.warn(`Warning creating constraint: ${err.message}`);
      }
    }
    
    // Import vats
    console.log(`Importing ${data.vats.length} vats...`);
    for (const vat of data.vats) {
      await session.run(
        `MERGE (v:Vat {vatID: $vatID})
         ON CREATE SET v.name = $name, v.createdAt = $time`,
        vat
      );
    }
    
    // Import blocks
    console.log(`Importing ${data.blocks.length} blocks...`);
    for (const block of data.blocks) {
      await session.run(
        `MERGE (b:Block {height: $height})
         ON CREATE SET b.time = $time, b.blockTime = $blockTime`,
        block
      );
    }
    
    // Import deliveries (messages)
    console.log(`Importing ${data.deliveries.length} deliveries...`);
    for (const delivery of data.deliveries) {
      if (delivery.type === 'message') {
        await session.run(
          `MATCH (v:Vat {vatID: $vatID})
           CREATE (d:Delivery {
             type: 'message',
             crankNum: $crankNum,
             method: $method,
             time: $time
           })
           CREATE (d)-[:DELIVERED_TO]->(v)
           WITH d
           MATCH (b:Block {height: $blockHeight})
           CREATE (b)-[:CONTAINS]->(d)`,
          delivery
        );
      }
    }
    
    // Import syscalls
    console.log(`Importing ${data.syscalls.length} syscalls...`);
    for (const syscall of data.syscalls) {
      if (syscall.type === 'send') {
        await session.run(
          `MATCH (v:Vat {vatID: $vatID})
           CREATE (s:Syscall {
             type: 'send',
             method: $method,
             time: $time,
             target: $target
           })
           CREATE (v)-[:MAKES]->(s)
           WITH s
           MATCH (b:Block {height: $blockHeight})
           CREATE (b)-[:CONTAINS]->(s)`,
          syscall
        );
      }
    }
    
    // Create some helpful indexes
    const indexes = [
      `CREATE INDEX delivery_time IF NOT EXISTS FOR (d:Delivery) ON (d.time)`,
      `CREATE INDEX syscall_time IF NOT EXISTS FOR (s:Syscall) ON (s.time)`
    ];
    
    for (const index of indexes) {
      try {
        await session.run(index);
      } catch (err) {
        console.warn(`Warning creating index: ${err.message}`);
      }
    }
    
    console.log('Neo4j graph created successfully');
    
  } finally {
    await session.close();
  }
}

/**
 * Process a slog file and create Neo4j graph
 */
async function processSlogToNeo4j(inputFile) {
  console.log(`Processing ${inputFile} to Neo4j...`);
  
  try {
    // First process the slog file
    const entries = readJSONLinesFromFile(inputFile);
    const data = await processSlogEntries(entries);
    
    // Connect to Neo4j
    const driver = await connectToNeo4j();
    
    try {
      // Create Neo4j graph
      await createNeo4jGraph(data, driver);
      
      console.log(`
Processing completed:
- Vats: ${data.vats.length}
- Deliveries: ${data.deliveries.length}
- Syscalls: ${data.syscalls.length}
- Blocks: ${data.blocks.length}
- Promises: ${data.promises.length}
      `);
      
    } finally {
      await driver.close();
    }
    
  } catch (error) {
    console.error('Error processing slog file:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
export async function run() {
  const [_node, _script, inputFile] = process.argv;
  
  if (!inputFile) {
    console.log('Usage: node slog2neo4j.js <inputFile>');
    process.exit(64);
  }
  
  try {
    await processSlogToNeo4j(inputFile);
  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  }
}

// Run the program if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
}