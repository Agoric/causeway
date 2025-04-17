// This file is a copy of the root file, moved to the tools directory for better organization

// Original content from processSlogs.js
import neo4j from 'neo4j-driver';
import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';

// Configuration management
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'secretpassword'
  },
  batch: {
    size: parseInt(process.env.BATCH_SIZE || '10', 10),
    retries: parseInt(process.env.BATCH_RETRIES || '3', 10)
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Metrics tracking
class Metrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.processedBlocks = 0;
    this.processedDeliveries = 0;
    this.processedSyscalls = 0;
    this.failedBatches = 0;
    this.startTime = Date.now();
    this.processingTimes = {
      delivery: 0,
      syscall: 0,
      total: 0
    };
  }

  logStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(`
Processing Statistics:
- Blocks processed: ${this.processedBlocks}
- Deliveries processed: ${this.processedDeliveries}
- Syscalls processed: ${this.processedSyscalls}
- Failed batches: ${this.failedBatches}
- Total time: ${elapsed.toFixed(2)}s
- Average time per block: ${(elapsed / this.processedBlocks).toFixed(2)}s
    `);
  }
}

const metrics = new Metrics();

/**
 * Connects to Neo4j database with retry mechanism
 */
async function connectToNeo4j(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
      );
      await driver.verifyConnectivity();
      console.log('Connected to Neo4j');
      return driver;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Connection attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Sets up database schema, constraints, and indexes
 */
async function setupSchema(session) {
  const constraints = [
    `CREATE CONSTRAINT block_id IF NOT EXISTS
     FOR (b:Block) REQUIRE b.blockNum IS UNIQUE`,
    
    `CREATE CONSTRAINT vat_id IF NOT EXISTS
     FOR (v:Vat) REQUIRE v.vatID IS UNIQUE`,
    
    `CREATE CONSTRAINT syscall_id IF NOT EXISTS
     FOR (s:Syscall) REQUIRE (s.crankNum, s.syscallNum) IS NODE KEY`,
    
    `CREATE CONSTRAINT promise_id IF NOT EXISTS
     FOR (p:Promise) REQUIRE p.kpid IS UNIQUE`
  ];

  const indexes = [
    `CREATE INDEX delivery_id IF NOT EXISTS
     FOR (d:Delivery) ON (d.crankNum)`,
    
    `CREATE INDEX delivery_time IF NOT EXISTS
     FOR (d:Delivery) ON (d.timestamp)`,
    
    `CREATE INDEX object_ref IF NOT EXISTS
     FOR (o:Object) ON (o.kref)`
  ];

  // for (const constraint of constraints) {
  //   await session.run(constraint);
  // }

  for (const index of indexes) {
    await session.run(index);
  }
}

/**
 * Process bootstrap block
 */
async function processBootstrapBlock(data, batch) {
  await batch.run(`
    CREATE (b:Block {
      blockNum: 'bootstrap7' + $random,
      blockTime: $blockTime,
      timestamp: $timestamp
    })
  `, {
    blockTime: data.blockTime,
    timestamp: data.time,
    random: Math.floor(10 + Math.random() * 1000)
  });
}

/**
 * Process delivery events
 */
async function processDelivery(delivery, batch, data) {
  const startTime = Date.now();
  const { crankNum, vatID, deliveryNum, kd } = delivery;
  // Create delivery node
  await batch.run(`
    MERGE (v:Vat {vatID: $vatID})
    CREATE (d:Delivery {
      crankNum: $crankNum,
      deliveryNum: $deliveryNum,
      timestamp: $timestamp,
      type: $type,
      data: $data
    })
    CREATE (v)-[:PROCESSES {
      data: $data
    }]->(d)
  `, {
    blockNum: 1,
    vatID,
    crankNum,
    deliveryNum,
    timestamp: delivery.time,
    type: kd[0],
    data: JSON.stringify(data)
  });

  // Handle message deliveries
  if (kd[0] === 'message') {
    const target_kref = typeof kd[1] === 'string' ? kd[1] : kd[1].kref;
    const { methname, slots } = extractSmallcaps(kd[2].methargs);
    const result_kpid = kd[2].result;
    // Create message relationship
    await batch.run(`
      MERGE (v:Vat {vatID: $vatID})
      MERGE (d:Delivery {crankNum: $crankNum, data: $data})
      MERGE (o:Object {kref: $target_kref})
      MERGE (p:Promise {kpid: $result_kpid})
      CREATE (v)-[:CALLS {
        method: $methname,
        timestamp: $timestamp,
        data: $data
      }]->(o)
      CREATE (d)-[:CREATES {
        data: $data
      }]->(p)
    `, {
      crankNum,
      target_kref,
      result_kpid,
      methname,
      vatID,
      timestamp: delivery.time,
      data: JSON.stringify(data)
    });

    // Create slot references
    for (const slot of slots) {
      await batch.run(`
        MERGE (d:Delivery {crankNum: $crankNum})
        MERGE (o:Object {kref: $slot})
        MERGE (p:Promise {kpid: $result_kpid})
        CREATE (d)-[:REFERENCES{
          timestamp: $timestamp,
          data: $data
        }]->(o)
        CREATE (o)-[:CREATES {
          data: $data
        }]->(p)
      `, {
        crankNum,
        slot,
        timestamp: delivery.time,
        result_kpid,
        data: JSON.stringify(data)
      });
    }
  } else if (kd[0] === 'notify') {
    for (const [kpid, { state, data: resdata }] of kd[1]) {
      await batch.run(`
        MERGE (d:Delivery {crankNum: $crankNum})
        MERGE (p:Promise {kpid: $kpid})
        CREATE (d)-[:RESOLVES {
          state: $state,
          timestamp: $timestamp,
          data: $data
        }]->(p)
      `, {
        crankNum,
        kpid,
        state,
        timestamp: delivery.time,
        data: JSON.stringify(data)
      });

      const { slots } = extractSmallcaps(resdata);
      for (const slot of slots) {
        await batch.run(`
          MERGE (p:Promise {kpid: $kpid})
          MERGE (o:Object {kref: $slot})
          CREATE (p)-[:REFERENCES {
            data: $data
          }]->(o)
        `, {
          kpid,
          slot,
          data: JSON.stringify(data)
        });
      }
    }
  }

  metrics.processingTimes.delivery += Date.now() - startTime;
  metrics.processedDeliveries++;
}

/**
 * Process syscall events
 */
async function processSyscall(syscall, batch, data) {
  const startTime = Date.now();
  const { crankNum, vatID, syscallNum, ksc } = syscall;

  console.log({ crankNum, vatID, syscallNum, ksc });

  
  // Handle different syscall types
  if (ksc[0] === 'send') {
    const target_kref = ksc[1];
    const { methname, slots } = extractSmallcaps(ksc[2].methargs);
    const syscall_type = ksc[0];
    const syscall_obj = ksc[1];
    const result_kpid = ksc[2].result;

    /*
      MERGE (s:Syscall {crankNum: $crankNum, syscallNum: $syscallNum, type: $methname, data: $data})
      MERGE (s:Syscall {crankNum: $crankNum, syscallNum: $syscallNum, type: $methname, data: $data})
      CREATE (o)-[:CALLS {
        method: $methname,
        timestamp: $timestamp,
        data: $data
      }]->(s)
    */

    await batch.run(`
      MERGE (v:Vat {vatID: $vatID})
      
      MERGE (o:Object {kref: $target_kref})

      CREATE (v)-[:PROCESSES{
        timestamp: $timestamp,
        data: $data
      }]->(o)
    `, {
      vatID,
      crankNum,
      syscallNum,
      target_kref,
      methname,
      timestamp: syscall.time,
      data: JSON.stringify(data)
    });

    if (result_kpid) {
      await batch.run(`
        MERGE (v:Vat {vatID: $vatID})
        MERGE (p:Promise {kpid: $result_kpid})
        CREATE (o)-[:CREATES{
          method: $methname,
          timestamp: $timestamp,
          data: $data
        }]->(p)
      `, {
        vatID,
        crankNum,
        methname,
        syscallNum,
        timestamp: syscall.time,
        result_kpid,
        data: JSON.stringify(data)
      });
    }
  } else if (ksc[0] === 'resolve') {
    for (const resolution of ksc[2]) {
      const [kpid, rejected, capData] = resolution;
      const { slots } = extractSmallcaps(capData);


      await batch.run(`
        MERGE (v:Vat {vatID: $vatID})
        MERGE (p:Promise {kpid: $kpid})
        CREATE (s)-[:RESOLVES {
          rejected: $rejected,
          timestamp: $timestamp,
          data: $data
        }]->(p)
        CREATE (v)-[:PROCESSES {
          data: $data
        }]->(o)
      `, {
        type: ksc[0],
        vatID,
        crankNum,
        syscallNum,
        kpid,
        rejected,
        timestamp: syscall.time,
        data: JSON.stringify(data)
      });

      for (const slot of slots) {
        await batch.run(`
          MERGE (p:Promise {kpid: $kpid})
          MERGE (o:Object {kref: $slot})
          CREATE (p)-[:REFERENCES{
            timestamp: $timestamp,
            data: $data
          }]->(o)
        `, {
          kpid,
          slot,
          timestamp: syscall.time,
          data: JSON.stringify(data)
        });
      }
    }
  } else {
    console.log("syscall XXXXXXXXXXXXXXXXXXXXXXXXXXX");
    await batch.run(`
      MERGE (v:Vat {vatID: $vatID})
      CREATE (s:Syscall {
        syscallNum: $syscallNum,
        type: $type,
        timestamp: $timestamp,
        data: $data
      })
      CREATE (v)-[:PROCESSES{
        timestamp: $timestamp,
        data: $data
      }]->(s)
    `, {
      vatID,
      crankNum,
      syscallNum,
      type: ksc[0],
      timestamp: syscall.time,
      data: JSON.stringify(data)
    });
  
  }

  metrics.processingTimes.syscall += Date.now() - startTime;
  metrics.processedSyscalls++;
}

/**
 * Process a single log file
 */
async function processFileForNeo4j(slogfileName, driver) {
  console.log(`Processing ${slogfileName} for Neo4j`);
  let slog = fs.createReadStream(slogfileName);
  if (slogfileName.endsWith('.gz')) {
    slog = slog.pipe(zlib.createGunzip());
  }
  
  const lines = readline.createInterface({ input: slog });
  const session = driver.session();
  
  try {
    await setupSchema(session);
    
    let blockNum = 7; // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    let delivery;
    let syscall;
    let batchCount = 0;
    let batch = session.beginTransaction();
    
    console.log("bootstrap block");

    //await processBootstrapBlock({blockHeight: 1, blockTime: 1, time: 1}, batch);
    console.log("bootstrap block done");
    for await (const line of lines) {
      const data = JSON.parse(line);
      
      if (data.replay) continue;

      try {
        // Handle different event types
        switch (data.type) {
          case 'cosmic-swingset-bootstrap-block-start':
            await processBootstrapBlock(data, batch);
            batchCount++;
            break;

          case 'cosmic-swingset-begin-block':
            blockNum = data.blockHeight;
            console.log("begin block");
            await batch.run(`
              CREATE (b:Block {
                blockNum: $blockNum,
                blockTime: $blockTime,
                timestamp: $timestamp,
                data: $data
              })
            `, {
              blockNum: data.blockHeight,
              blockTime: data.blockTime,
              timestamp: data.time,
              data: JSON.stringify(data)
            });
            metrics.processedBlocks++;
            batchCount++;
            break;

          case 'deliver':
            console.log("deliver");
            delivery = { ...data, blockNum };
            await processDelivery(delivery, batch, data);
            batchCount++;
            break;

          case 'syscall':
            console.log("syscall");
            syscall = { ...data, blockNum };
            await processSyscall(syscall, batch, data);
            batchCount++;
            break;
        }

        console.log("batchCount", batchCount);
        // Commit batch when size limit is reached
        if (batchCount >= config.batch.size) {
          console.log(`Committing batch at block ${blockNum} (${batchCount} operations)`);
          await batch.commit();
          batch = session.beginTransaction();
          batchCount = 0;
        }

      } catch (error) {
        console.error('Error processing event:', error);
        console.error(error.stack);
        metrics.failedBatches++;
        await batch.rollback();
        batch = session.beginTransaction();
        batchCount = 0;
      }
    }

    // Commit any remaining transactions
    if (batchCount > 0) {
      console.log(`Committing final batch (${batchCount} operations)`);
      await batch.commit();
    }
    
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Helper function to extract method name and slots from smallcaps
 */
function extractSmallcaps(methargs_smallcaps) {
  const { body, slots } = methargs_smallcaps;
  if (body[0] !== '#') {
    throw Error('ersatz decoder only handles smallcaps');
  }
  const methargs = JSON.parse(body.slice(1));
  const methname = methargs[0];
  return { methname, slots };
}

/**
 * Example queries for analysis
 */
async function runAnalysisQueries(session) {
  const queries = [
    // Most active vats
    `MATCH (v:Vat)-[:PROCESSES]->(d:Delivery)
     RETURN v.vatID, count(d) as deliveries
     ORDER BY deliveries DESC
     LIMIT 5`,

    // Message patterns over time
    `MATCH (b:Block)-[:CONTAINS]->(d:Delivery)-[:CALLS]->(o:Object)
     RETURN b.blockNum, count(d) as messages
     ORDER BY b.blockNum
     LIMIT 100`,

    // Promise resolution chains
    `MATCH path = (d1:Delivery)-[:CREATES]->(p:Promise)<-[:RESOLVES]-(d2:Delivery)
     RETURN path
     LIMIT 100`,

    // Object reference patterns
    `MATCH (o:Object)<-[:REFERENCES]-(d:Delivery)
     RETURN o.kref, count(d) as refs
     ORDER BY refs DESC
     LIMIT 10`
  ];

  for (const query of queries) {
    const result = await session.run(query);
    console.log(`Query result:`, result.records);
  }
}

/**
 * Main execution function
 */
async function run() {
  const [_node, _script, ...slogfileNames] = process.argv;
  
  if (slogfileNames.length === 0) {
    console.log('Usage: node processSlogs.js slogFile...');
    process.exit(64);
  }
  
  const driver = await connectToNeo4j(config.batch.retries);
  let session;
  
  try {
    // Process each log file
    for (const slogfileName of slogfileNames) {
      console.log(`\nProcessing file: ${slogfileName}`);
      await processFileForNeo4j(slogfileName, driver);
    }
    
    // Run analysis queries
    console.log('\nRunning analysis queries...');
    session = driver.session();
    await runAnalysisQueries(session);
    
    // Log final statistics
    console.log('\nProcessing completed!');
    metrics.logStats();

  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (session) {
      await session.close();
    }
    await driver.close();
    console.log('Database connections closed');
  }
}

// Add error handling for the main execution
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the program
run().catch(error => {
  console.error('Error in main execution:', error);
  process.exit(1);
});