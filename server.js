// Backend API for Neo4j interactions
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Neo4j connection settings from environment variables
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'secretpassword';

// Create a Neo4j driver instance
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { 
    encrypted: NEO4J_URI.includes('neo4j+s') || NEO4J_URI.includes('bolt+s'),
    disableLosslessIntegers: true
  }
);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'neo4j-diagram-app/build')));

// Test database connection
async function testConnection() {
  try {
    await driver.verifyConnectivity();
    console.log('Connected to Neo4j database');
    return true;
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    return false;
  }
}

// API Routes

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const isConnected = await testConnection();
  if (isConnected) {
    res.json({ status: 'ok', message: 'Connected to Neo4j database' });
  } else {
    res.status(500).json({ status: 'error', message: 'Failed to connect to Neo4j database' });
  }
});

// Get all vats
app.get('/api/vats', async (req, res) => {
  const session = driver.session();
  
  try {
    const result = await session.run(`
      MATCH (v:Vat)
      RETURN v.vatID as vatID, v.name as name
    `);
    
    const vats = result.records.map(record => ({
      vatID: record.get('vatID'),
      name: record.get('name')
    }));
    
    res.json(vats);
  } catch (error) {
    console.error('Error fetching vats:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Get interactions between vats based on time range
app.get('/api/interactions', async (req, res) => {
  const session = driver.session();
  
  try {
    const { startTime, endTime } = req.query;
    
    // Default to a large time range if not specified
    const startTimestamp = parseFloat(startTime) || 0;
    const endTimestamp = parseFloat(endTime) || Math.floor(Date.now() / 1000);
    
    // Query message interactions
    const messageQuery = `
      MATCH (m:Message)-[call:CALL]->(target:Vat),
            (caller:Vat)-[:CALLED_BY]->(m)
      WHERE m.time >= $startTime AND m.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
            target.vatID  AS targetVat,
            m.method as method,
            m.time as time,
            'message' as type
      ORDER BY m.time
    `;
    
    // Query notify interactions
    const notifyQuery = `
      MATCH  (n:Notify)-[:CALLED_BY]->(caller:Vat),
            (n)-[:CALL]->(target:Vat) 
      WHERE  n.time >= $startTime
        AND  n.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
            target.vatID  AS targetVat,
            n.method      AS method,
            n.time        AS time,
            'notify'      AS type
      ORDER BY n.time;
    `;
    
    // Execute queries
    const messageResult = await session.run(messageQuery, { 
      startTime: startTimestamp, 
      endTime: endTimestamp 
    });
    
    const notifyResult = await session.run(notifyQuery, { 
      startTime: startTimestamp, 
      endTime: endTimestamp 
    });
    
    // Process results
    const messageInteractions = messageResult.records.map(record => ({
      sourceVat: record.get('sourceVat'),
      targetVat: record.get('targetVat'),
      method: record.get('method'),
      time: record.get('time').toNumber ? record.get('time').toNumber() : record.get('time'),
      type: record.get('type')
    }));
    
    const notifyInteractions = notifyResult.records.map(record => ({
      sourceVat: record.get('sourceVat'),
      targetVat: record.get('targetVat'),
      method: record.get('method'),
      time: record.get('time').toNumber ? record.get('time').toNumber() : record.get('time'),
      type: record.get('type')
    }));
    
    // Combine all interactions
    const allInteractions = [
      ...messageInteractions,
      ...notifyInteractions,
    ];
    
    res.json({
      vats: [],  // Will be populated by separate endpoint
      interactions: allInteractions,
      meta: {
        startTime: startTimestamp,
        endTime: endTimestamp,
        count: allInteractions.length
      }
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Import log file endpoint
app.post('/api/import', async (req, res) => {
  // This would be a more complex implementation
  // You would need to handle file uploads, process the content, and insert into Neo4j
  // For now, return a mock response to acknowledge the endpoint exists
  res.json({ 
    status: 'success', 
    message: 'Log import endpoint exists but is not fully implemented in this demo'
  });
});

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'neo4j-diagram-app/build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  testConnection();
});

// Handle process termination
process.on('SIGINT', async () => {
  await driver.close();
  console.log('Neo4j connection closed');
  process.exit(0);
});