import React, { useState } from 'react';
import neo4j from 'neo4j-driver';

// Neo4j connection function with error handling
const createDriver = async (uri, username, password) => {
  try {
    // Create driver with encryption disabled for local connections
    const driver = neo4j.driver(
      uri, 
      neo4j.auth.basic(username, password),
      { 
        encrypted: uri.includes('neo4j+s') || uri.includes('bolt+s'),
        disableLosslessIntegers: true
      }
    );
    
    // Test the connection
    await driver.verifyConnectivity();
    return driver;
  } catch (error) {
    // Provide more detailed error information
    let errorMessage = error.message;
    
    if (error.code === 'ServiceUnavailable') {
      errorMessage = 'Neo4j database is not available at the provided URI. Please check that the database is running and accessible.';
    } else if (error.code === 'Neo.ClientError.Security.Unauthorized') {
      errorMessage = 'Invalid username or password. Please check your credentials.';
    } else if (error.message.includes('WebSocket connection failure')) {
      errorMessage = 'WebSocket connection failed. This may be due to CORS restrictions or network issues. For local Neo4j, make sure to use bolt://localhost:7687 and not http://localhost:7474.';
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Generate Neo4j nodes and relationships from processed slog data
 * @param {Object} data - Processed slog data
 * @param {neo4j.Session} session - Active Neo4j session
 */
async function generateNeo4jGraph(data, session) {
  const { vats, deliveries, syscalls, blocks } = data;
  const promises = data.promises || [];

  // Create Vat nodes
  for (const vat of vats) {
    try {
      await session.run(
        `MERGE (v:Vat {vatID: $vatID})
         SET v.name = $name, v.createdAt = $time`,
        { vatID: vat.vatID, name: vat.name, time: vat.time }
      );
    } catch (error) {
      console.error('Error creating Vat node:', error);
    }
  }

  // Create Block nodes
  for (const block of blocks) {
    try {
      await session.run(
        `MERGE (b:Block {height: $height})
         SET b.time = $time, b.blockTime = $blockTime`,
        { height: block.height, time: block.time, blockTime: block.blockTime }
      );
    } catch (error) {
      console.error('Error creating Block node:', error);
    }
  }

  // Create Message deliveries as nodes and relationships
  for (const msg of deliveries) {
    try {
      if (msg.type === 'notify') {
        await session.run(
          `CREATE (n:Notify {method: $method, time: $time, kpid: $kpid, blockHeight: $blockHeight})
           WITH n
           MATCH (v:Vat {vatID: $vatID})
           OPTIONAL MATCH (m:Message {result: $kpid})
           WITH n, v, m
           WHERE m IS NOT NULL
           CREATE (v)-[:CALLED_BY{object: $kpid}]->(m)
           CREATE (n)-[:CALL{object: $kpid, method: $method, call: $call }]->(v)`,
          {
            method: msg.state || 'unknown',
            time: msg.time,
            vatID: msg.vatID,
            kpid: msg.kpid || null,
            call: `${msg.kpid}->${msg.state}()`,
            blockHeight: msg.blockHeight || null
          }
        );
      } else if (msg.type === 'message') {
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
            call: `${msg.target || 'unknown'}->${msg.method || 'unknown'}()`,
            blockHeight: msg.blockHeight || null
          }
        );
      }
    } catch (error) {
      console.error('Error creating delivery node:', error);
    }
  }

  // Create Syscalls and relationships
  for (const syscall of syscalls) {
    try {
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
    } catch (error) {
      console.error('Error creating syscall node:', error);
    }
  }

  // Create promise nodes and relationships
  for (const promise of promises) {
    try {
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
    } catch (error) {
      console.error('Error creating promise relationship:', error);
    }
  }
}

// Helper to get timestamp display
const formatUnixTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    // Convert to ms if needed and format
    const date = new Date(timestamp * (timestamp > 10000000000 ? 1 : 1000));
    return date.toISOString().replace('T', ' ').substring(0, 19);
  } catch (e) {
    return 'Invalid timestamp';
  }
};

// Processes a JSON log file
const processLogFile = async (file, setProgress) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const lines = event.target.result.split('\n');
        const totalLines = lines.length;
        
        setProgress(`Processing ${totalLines} log entries...`);
        
        const data = {
          vats: [],
          deliveries: [],
          syscalls: [],
          blocks: [],
          promises: []
        };
        
        let processedLines = 0;
        let minTime = Number.MAX_VALUE;
        let maxTime = 0;
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const entry = JSON.parse(line);
            const { type, vatID, time } = entry;
            
            // Track min/max times for reporting
            if (time && !isNaN(parseFloat(time))) {
              const timeValue = parseFloat(time);
              minTime = Math.min(minTime, timeValue);
              maxTime = Math.max(maxTime, timeValue);
            }
            
            switch (type) {
              case 'create-vat':
                data.vats.push({
                  vatID,
                  name: entry.name || 'unknown',
                  time
                });
                break;
                
              case 'cosmic-swingset-end-block-start':
                data.blocks.push({
                  height: entry.blockHeight,
                  time,
                  blockTime: entry.blockTime
                });
                break;
                
              case 'deliver':
                const { kd } = entry;
                if (kd && kd[0] === 'message') {
                  let method = 'unknown';
                  try {
                    const [_tag, targetRef, { methargs: { body }, result }] = kd;
                    const jsonString = body.startsWith('#') ? body.slice(1) : body;
                    [method] = JSON.parse(jsonString);
                    
                    data.deliveries.push({
                      type: 'message',
                      method,
                      vatID,
                      time,
                      target: targetRef,
                      result,
                      crankNum: entry.crankNum,
                      blockHeight: entry.blockHeight
                    });
                  } catch (parseError) {
                    // Log error and continue with default values
                    console.warn('Error parsing deliver message:', parseError);
                    data.deliveries.push({
                      type: 'message',
                      method: 'unknown',
                      vatID,
                      time,
                      target: 'unknown',
                      result: null,
                      crankNum: entry.crankNum,
                      blockHeight: entry.blockHeight
                    });
                  }
                } else if (kd && kd[0] === 'notify') {
                  // Ensure state is a valid string for Mermaid diagrams
                  let state = 'notification';
                  if (kd[2]) {
                    // Convert to string and sanitize
                    state = String(kd[2]).replace(/[^\w\s\-.,;:()]/g, '_');
                  }
                  
                  data.deliveries.push({
                    type: 'notify',
                    state: state,
                    vatID,
                    time,
                    kpid: kd[1],
                    blockHeight: entry.blockHeight
                  });
                }
                break;
                
              case 'syscall':
                const { ksc } = entry;
                if (ksc && ksc[0] === 'send') {
                  try {
                    const [, target, { method, result }] = ksc;
                    
                    data.syscalls.push({
                      type: 'send',
                      method,
                      vatID,
                      time,
                      target,
                      result
                    });
                  } catch (parseError) {
                    console.warn('Error parsing syscall send:', parseError);
                  }
                }
                break;
                
              default:
                // Skip other types
                break;
            }
          } catch (e) {
            console.warn('Error parsing JSON line:', e);
          }
          
          processedLines++;
          if (processedLines % 1000 === 0) {
            setProgress(`Processed ${processedLines}/${totalLines} log entries...`);
          }
        }
        
        const formattedMinTime = formatUnixTimestamp(minTime);
        const formattedMaxTime = formatUnixTimestamp(maxTime);
        
        setProgress(`Log processing complete. 
          Found ${data.vats.length} vats, ${data.deliveries.length} deliveries, ${data.syscalls.length} syscalls, ${data.blocks.length} blocks
          Time range: ${formattedMinTime} to ${formattedMaxTime}
          Timestamp range: ${minTime !== Number.MAX_VALUE ? minTime : 'N/A'} to ${maxTime !== 0 ? maxTime : 'N/A'}`);
        
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file);
  });
};

function LogImporter() {
  const [uri, setUri] = useState('bolt://localhost:7687');
  const [username, setUsername] = useState('neo4j');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState({ min: null, max: null });
  
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(`Selected file: ${e.target.files[0].name} (${(e.target.files[0].size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };
  
  const handleImport = async () => {
    if (!file) {
      setStatus('Please select a log file');
      return;
    }
    
    setIsLoading(true);
    setStatus('Processing log file...');
    
    let driver;
    try {
      // Process the log file
      const data = await processLogFile(file, setStatus);
      
      // Connect to Neo4j
      setStatus('Connecting to Neo4j...');
      driver = await createDriver(uri, username, password);
      const session = driver.session();
      
      // Generate Neo4j graph
      setStatus('Generating Neo4j graph...');
      await generateNeo4jGraph(data, session);
      
      await session.close();
      setStatus('Successfully imported log data into Neo4j');
      
      // Find min and max timestamps for informational purposes
      let minTime = Number.MAX_VALUE;
      let maxTime = 0;
      
      // Check deliveries for time range
      data.deliveries.forEach(item => {
        if (item.time) {
          const time = parseFloat(item.time);
          if (!isNaN(time)) {
            minTime = Math.min(minTime, time);
            maxTime = Math.max(maxTime, time);
          }
        }
      });
      
      // Check syscalls for time range
      data.syscalls.forEach(item => {
        if (item.time) {
          const time = parseFloat(item.time);
          if (!isNaN(time)) {
            minTime = Math.min(minTime, time);
            maxTime = Math.max(maxTime, time);
          }
        }
      });
      
      // Update UI with time range information
      if (minTime !== Number.MAX_VALUE && maxTime !== 0) {
        setTimeRange({ min: minTime, max: maxTime });
      }
      
    } catch (error) {
      console.error('Error importing logs:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      if (driver) {
        await driver.close();
      }
      setIsLoading(false);
    }
  };
  
  return (
    <div className="log-importer">
      <h3>Import Log File to Neo4j</h3>
      
      <div className="form-group">
        <label>Neo4j URI:</label>
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="bolt://localhost:7687"
        />
        <small className="form-text">
          For local Neo4j use: bolt://localhost:7687
        </small>
      </div>
      
      <div className="form-group">
        <label>Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="neo4j"
        />
      </div>
      
      <div className="form-group">
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
        />
      </div>
      
      <div className="form-group">
        <label>Log File (jsonl):</label>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".json,.jsonl,.log"
        />
        <small className="form-text">
          Select a JSON Lines log file with one JSON object per line
        </small>
      </div>
      
      <button 
        onClick={handleImport}
        disabled={isLoading || !password || !file}
      >
        {isLoading ? 'Importing...' : 'Import Log to Neo4j'}
      </button>
      
      {status && <div className={`status-message ${status.includes('error') || status.includes('Error') ? 'error' : ''}`}>{status}</div>}
      
      {timeRange.min && (
        <div className="time-range-info">
          <h4>Time Range Information</h4>
          <p>To view this data in the diagram tab, use these timestamps:</p>
          <ul>
            <li><strong>Start time:</strong> {timeRange.min}</li>
            <li><strong>End time:</strong> {timeRange.max}</li>
            <li><strong>Start date:</strong> {formatUnixTimestamp(timeRange.min)}</li>
            <li><strong>End date:</strong> {formatUnixTimestamp(timeRange.max)}</li>
          </ul>
        </div>
      )}
      
      <div className="troubleshooting">
        <h4>Troubleshooting</h4>
        <ul>
          <li>Make sure your Neo4j database is running</li>
          <li>For local installations, use <code>bolt://localhost:7687</code></li>
          <li>Check that username and password are correct</li>
          <li>The log file should be in JSONL format (one JSON object per line)</li>
          <li>After importing, switch to the "View Diagram" tab to visualize the data</li>
        </ul>
      </div>
    </div>
  );
}

export default LogImporter;