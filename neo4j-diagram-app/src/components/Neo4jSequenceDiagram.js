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

// Function to generate Mermaid sequence diagram from Neo4j data with pagination
const generateMermaidSequenceDiagram = (interactions, vats, maxInteractionsPerPage = 20) => {
  if (!interactions || interactions.length === 0) {
    return `sequenceDiagram
    Note over System: No interactions found in the selected time range`;
  }

  // Sort interactions by time
  interactions.sort((a, b) => a.time - b.time);
  
  // Calculate how many pages we need
  const totalPages = Math.ceil(interactions.length / maxInteractionsPerPage);
  
  // If only one page is needed, use the regular format
  if (totalPages <= 1) {
    return generateSinglePageDiagram(interactions, vats);
  }
  
  // Split interactions into pages
  let pages = [];
  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * maxInteractionsPerPage;
    const endIdx = Math.min((i + 1) * maxInteractionsPerPage, interactions.length);
    pages.push(interactions.slice(startIdx, endIdx));
  }
  
  // Generate diagram with pages
  let diagram = '';
  
  pages.forEach((pageInteractions, pageIndex) => {
    // Start a new diagram for each page
    if (pageIndex > 0) {
      // Ensure a complete separation between pages - each page is a separate diagram
      diagram += `\n---\n`;
    }
    
    // Generate a title showing page number and time range
    const fromTime = new Date(pageInteractions[0].time * (pageInteractions[0].time > 10000000000 ? 1 : 1000))
      .toISOString().replace('T', ' ').substring(0, 19);
    const toTime = new Date(pageInteractions[pageInteractions.length - 1].time * 
                          (pageInteractions[pageInteractions.length - 1].time > 10000000000 ? 1 : 1000))
      .toISOString().replace('T', ' ').substring(0, 19);
    
    // Header for this page
    diagram += `sequenceDiagram\n`;
    diagram += `    title Page ${pageIndex + 1}/${totalPages}: ${fromTime} to ${toTime}\n`;
    
    // Add participants for this page
    diagram += generateParticipants(vats, pageInteractions);
    
    // Add interactions for this page
    diagram += generateInteractions(pageInteractions, vats);
  });
  
  return diagram;
};

// Function to generate a single page diagram (no pagination)
const generateSinglePageDiagram = (interactions, vats) => {
  let diagram = 'sequenceDiagram\n';
  
  // Add participants
  diagram += generateParticipants(vats, interactions);
  
  // Add interactions
  diagram += generateInteractions(interactions, vats);
  
  return diagram;
};

// Function to generate participant definitions
const generateParticipants = (vats, interactions) => {
  let result = '';
  
  // Collect all vat IDs for participants
  const vatIds = new Set();
  vats.forEach(vat => {
    vatIds.add(vat.vatID);
  });
  
  // Check if we need System participant
  const hasSystemMessages = interactions.some(i => i.sourceVat === 'system' || i.targetVat === 'system');
  
  // Add vat participants
  Array.from(vatIds).forEach(vatId => {
    // Skip vats that aren't in this page's interactions
    const vatIsInvolved = interactions.some(i => 
      i.sourceVat === vatId || i.targetVat === vatId
    );
    
    if (!vatIsInvolved) return;
    
    // Sanitize vatId for Mermaid
    const safeVatId = `Vat_${vatId.replace(/[^\w]/g, '_')}`;
    // Get vat name if available
    const vat = vats.find(v => v.vatID === vatId);
    const displayName = vat?.name || vatId;
    // Truncate long vat names for better readability
    const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
    result += `    participant ${safeVatId} as "${truncatedName}"\n`;
  });
  
  // Add system participant if needed
  if (hasSystemMessages) {
    result += `    participant System as "System"\n`;
  }
  
  return result;
};

// Function to generate the interaction lines
const generateInteractions = (interactions, vats) => {
  let result = '';
  
  // Collect all vat IDs
  const vatIds = new Set();
  vats.forEach(vat => {
    vatIds.add(vat.vatID);
  });
  
  // Add interactions with logical break markers
  interactions.forEach((interaction, index) => {
    const { sourceVat, targetVat, method, type, time } = interaction;
    
    // Skip if missing source or target
    if (!sourceVat || !targetVat) return;
    
    // Format timestamp for note
    const formattedTime = new Date(time * (time > 10000000000 ? 1 : 1000))
      .toISOString().replace('T', ' ').substring(0, 19);
    
    // Handle the syscall case specially
    if (type === 'syscall' && vatIds.has(sourceVat)) {
      // For syscalls to external targets
      if (!vatIds.has(targetVat) && targetVat !== 'system') {
        // Extract target name from the format 'target:name'
        const externalName = targetVat.startsWith('target:') ? targetVat.substring(7) : targetVat;
        
        // Sanitize source vat ID for Mermaid
        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
        
        // Format method with target name
        const methodDisplay = method && method.length > 15 ? 
          `${method.substring(0, 15)}... (${externalName.substring(0, 15)})` : 
          `${method || 'unknown'} (${externalName.substring(0, 15)})`;
        
        // Use 'x' arrow for external calls
        result += `    ${safeSourceVat}-x>External: ${methodDisplay}\n`;
      } 
      // For syscalls between vats (rare, but could happen)
      else if (vatIds.has(targetVat)) {
        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
        const safeTargetVat = `Vat_${targetVat.replace(/[^\w]/g, '_')}`;
        
        const methodDisplay = method && method.length > 20 ? 
          `${method.substring(0, 20)}...` : 
          (method || 'unknown');
        
        result += `    ${safeSourceVat}->>>${safeTargetVat}: ${methodDisplay}\n`;
      }
    }
    // Handle normal vat-to-vat or system-to-vat interactions
    else {
      // Handle source
      let safeSourceVat;
      if (sourceVat === 'system') {
        safeSourceVat = 'System';
      } else if (vatIds.has(sourceVat)) {
        safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
      } else {
        // Skip if source isn't valid
        return;
      }
      
      // Handle target
      let safeTargetVat;
      if (targetVat === 'system') {
        safeTargetVat = 'System';
      } else if (vatIds.has(targetVat)) {
        safeTargetVat = `Vat_${targetVat.replace(/[^\w]/g, '_')}`;
      } else {
        // Skip if target isn't valid
        return;
      }
      
      // Different arrow types based on interaction type
      let arrow = '->>+';
      if (type === 'notify') {
        arrow = '-->>+';
      } else if (type === 'message') {
        arrow = '->>+';
      }
      
      // Truncate method name if too long and sanitize it
      let methodDisplay = method && method.length > 25 ? 
        method.substring(0, 25) + '...' : 
        (method || 'unknown');
      
      // Ensure method name doesn't contain any Mermaid syntax characters
      methodDisplay = methodDisplay.replace(/[^\w\s\-.,;:()]/g, '_');
      
      // Add the interaction line
      result += `    ${safeSourceVat}${arrow}${safeTargetVat}: ${methodDisplay}\n`;
    }
    
    // Add logical breaks every 5 interactions for better readability
    if (index % 5 === 4 && index < interactions.length - 1) {
      const nextTime = interactions[index + 1].time;
      const timeGap = nextTime - time;
      const significantGap = timeGap > 30; // More than 30 seconds gap
      
      if (significantGap) {
        result += `    Note over System: Time gap (${Math.floor(timeGap)} seconds)\n`;
      }
    }
  });
  
  return result;
};

// Convert string timestamp (1729570627.218393) to numeric timestamp
const parseTimestamp = (timestampStr) => {
  if (!timestampStr) return null;
  const num = parseFloat(timestampStr);
  return isNaN(num) ? null : num;
};

// Main component for fetching and displaying Neo4j data as a Mermaid diagram
function Neo4jSequenceDiagram({ onDiagramGenerated }) {
  const [uri, setUri] = useState('bolt://localhost:7687');
  const [username, setUsername] = useState('neo4j');
  const [password, setPassword] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [interactionsPerPage, setInteractionsPerPage] = useState(20);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Function to fetch data from Neo4j
  const fetchData = async () => {
    setIsLoading(true);
    setStatus('Connecting to Neo4j...');
    
    // Parse Unix timestamps
    const startTimestamp = parseTimestamp(startTime);
    const endTimestamp = parseTimestamp(endTime) || Math.floor(Date.now() / 1000); // Default to now
    
    let driver;
    try {
      driver = await createDriver(uri, username, password);
      
      setStatus('Connected. Fetching data...');
      
      const session = driver.session();
      
      try {
        // Get all vats first
        const vatsQuery = `
          MATCH (v:Vat)
          RETURN v.vatID as vatID, v.name as name
        `;
        
        const vatsResult = await session.run(vatsQuery);
        const vats = vatsResult.records.map(record => ({
          vatID: record.get('vatID'),
          name: record.get('name')
        }));
        
        // Get message interactions (message to vat)
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
        
        // Get notify interactions
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
        
        // Execute all queries
        let messageInteractions = [];
        let notifyInteractions = [];
        
        try {
          const messageResult = await session.run(messageQuery, { startTime: startTimestamp, endTime: endTimestamp });
          messageInteractions = messageResult.records.map(record => ({
            sourceVat: record.get('sourceVat'),
            targetVat: record.get('targetVat'),
            method: record.get('method'),
            time: record.get('time').toNumber ? record.get('time').toNumber() : record.get('time'),
            type: record.get('type')
          }));
        } catch (err) {
          console.warn('Error fetching message interactions:', err);
        }
        
        try {
          const notifyResult = await session.run(notifyQuery, { startTime: startTimestamp, endTime: endTimestamp });
          notifyInteractions = notifyResult.records.map(record => ({
            sourceVat: record.get('sourceVat'),
            targetVat: record.get('targetVat'),
            method: record.get('method'),
            time: record.get('time').toNumber ? record.get('time').toNumber() : record.get('time'),
            type: record.get('type')
          }));
        } catch (err) {
          console.warn('Error fetching notify interactions:', err);
        }
        
        // Process and sanitize all interactions
        const processedMessageInteractions = messageInteractions.map(interaction => {
          // Ensure method is valid for Mermaid
          if (interaction.method) {
            interaction.method = String(interaction.method).replace(/[^\w\s\-.,;:()]/g, '_');
          }
          return interaction;
        });
        
        const processedNotifyInteractions = notifyInteractions.map(interaction => {
          // Ensure method is valid for Mermaid
          if (interaction.method) {
            interaction.method = String(interaction.method).replace(/[^\w\s\-.,;:()]/g, '_');
          }
          return interaction;
        });
        
        // Combine all interactions
        const allInteractions = [
          ...processedMessageInteractions,
          ...processedNotifyInteractions,
        ];
        
        await session.close();
        
        // Generate the Mermaid diagram with pagination
        setStatus(`Found ${allInteractions.length} interactions. Generating diagram...`);
        const diagram = generateMermaidSequenceDiagram(allInteractions, vats, interactionsPerPage);
        onDiagramGenerated(diagram);
        
        // Calculate pages for status message
        const pageCount = Math.ceil(allInteractions.length / interactionsPerPage);
        const pagesInfo = pageCount > 1 ? ` Split into ${pageCount} pages.` : '';
        
        setStatus(`Diagram generated successfully with ${allInteractions.length} interactions between ${vats.length} vats.${pagesInfo}`);
      } catch (dbError) {
        console.error('Database query error:', dbError);
        setStatus(`Database error: ${dbError.message}`);
      } finally {
        await session.close();
      }
    } catch (error) {
      console.error('Connection error:', error);
      setStatus(`Connection error: ${error.message}`);
    } finally {
      if (driver) {
        await driver.close();
      }
      setIsLoading(false);
    }
  };
  
  return (
    <div className="neo4j-form">
      <h3>Connect to Neo4j</h3>
      
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
        <label>Start Time (Unix timestamp):</label>
        <input
          type="text"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          placeholder="1729570627.218393"
        />
        <small className="form-text">
          Enter Unix timestamp, e.g. 1729570627.218393
        </small>
      </div>
      
      <div className="form-group">
        <label>End Time (Unix timestamp):</label>
        <input
          type="text"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          placeholder="1729570727.218393"
        />
        <small className="form-text">
          Leave empty to use current time
        </small>
      </div>
      
      <div className="form-group">
        <label>Interactions Per Page:</label>
        <input
          type="number"
          min="5"
          max="50"
          value={interactionsPerPage}
          onChange={(e) => setInteractionsPerPage(Math.max(5, Math.min(50, parseInt(e.target.value) || 20)))}
          placeholder="20"
        />
        <small className="form-text">
          Number of interactions to show per page (5-50). Use lower values for better readability.
        </small>
      </div>
      
      <button 
        onClick={fetchData}
        disabled={isLoading || !password}
      >
        {isLoading ? 'Loading...' : 'Generate Diagram'}
      </button>
      
      {status && <div className={`status-message ${status.includes('error') || status.includes('Error') ? 'error' : ''}`}>{status}</div>}
      
      <div className="troubleshooting">
        <h4>Troubleshooting</h4>
        <ul>
          <li>Make sure your Neo4j database is running</li>
          <li>For local installations, use <code>bolt://localhost:7687</code></li>
          <li>Check that username and password are correct</li>
          <li>For CORS issues, you may need to configure Neo4j to allow browser connections</li>
          <li>Times in the database are Unix timestamps (e.g., 1729570627.218393)</li>
          <li>Try adjusting the "Interactions Per Page" value to break diagrams into manageable pages</li>
        </ul>
      </div>
    </div>
  );
}

export default Neo4jSequenceDiagram;