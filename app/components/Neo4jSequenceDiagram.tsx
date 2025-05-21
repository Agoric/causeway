import { useState, useEffect } from 'react';
import api from '../services/api';

const generateMermaidSequenceDiagram = (
  interactions: any[],
  vats: any[],
  maxInteractionsPerPage: number = 20
) => {
  if (!interactions || interactions.length === 0) {
    return `sequenceDiagram
    Note over System: No interactions found in the selected time range`;
  }

  interactions.sort((a, b) => a.time - b.time);
  const totalPages = Math.ceil(interactions.length / maxInteractionsPerPage);

  // If only one page is needed, use the regular format
  if (totalPages <= 1) {
    return generateSinglePageDiagram(interactions, vats);
  }

  // Split interactions into pages
  let pages: any[][] = [];
  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * maxInteractionsPerPage;
    const endIdx = Math.min(
      (i + 1) * maxInteractionsPerPage,
      interactions.length
    );
    pages.push(interactions.slice(startIdx, endIdx));
  }

  // Return an array of separate diagram definitions that the MermaidDiagram component will render individually
  const diagrams = pages.map((pageInteractions, pageIndex) => {
    // Generate a title showing page number and time range
    const fromTime = new Date(
      pageInteractions[0].time *
        (pageInteractions[0].time > 10000000000 ? 1 : 1000)
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const toTime = new Date(
      pageInteractions[pageInteractions.length - 1].time *
        (pageInteractions[pageInteractions.length - 1].time > 10000000000
          ? 1
          : 1000)
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Create a complete diagram definition for this page
    let diagram = `sequenceDiagram\n`;
    diagram += `    title Page ${
      pageIndex + 1
    }/${totalPages}: ${fromTime} to ${toTime}\n`;

    // Add ALL participants for EVERY page - this ensures consistent display across pages
    diagram += generateParticipants(vats, interactions); // Pass ALL interactions to show all participants

    // But only add the interactions for this specific page
    diagram += generateInteractions(pageInteractions, vats);

    // If this page has no interactions for a particular vat, add a note
    if (pageInteractions.length === 0) {
      diagram += `    Note over System: No interactions on this page\n`;
    } else if (pageInteractions.length < 3) {
      // For pages with very few interactions, add a note to make the diagram more readable
      diagram += `    Note over System: Limited interactions on this page (${pageInteractions.length})\n`;
    }

    return diagram;
  });

  // Join with a special delimiter that we'll use to split the diagrams later
  return diagrams.join('\n%%DIAGRAM_PAGE_BREAK%%\n');
};

// Function to generate a single page diagram (no pagination)
const generateSinglePageDiagram = (interactions, vats) => {
  let diagram = 'sequenceDiagram\n';

  // For time range title
  if (interactions.length > 0) {
    const fromTime = new Date(
      interactions[0].time * (interactions[0].time > 10000000000 ? 1 : 1000)
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const toTime = new Date(
      interactions[interactions.length - 1].time *
        (interactions[interactions.length - 1].time > 10000000000 ? 1 : 1000)
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    diagram += `    title Sequence Diagram: ${fromTime} to ${toTime}\n`;
  }

  // Add all participants
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
  vats.forEach((vat) => {
    vatIds.add(vat.vatID);
  });

  // Check if we need System participant (for any page)
  const hasSystemMessages = interactions.some(
    (i) => i.sourceVat === 'system' || i.targetVat === 'system'
  );

  // Add all vat participants regardless of involvement in this specific page
  Array.from(vatIds).forEach((vatId) => {
    // Sanitize vatId for Mermaid
    const safeVatId = `Vat_${String(vatId).replace(/[^\w]/g, '_')}`;

    // Get vat name if available
    const vat = vats.find((v) => v.vatID === vatId);
    const displayName = vat?.name || vatId;

    // Truncate long vat names for better readability
    const truncatedName =
      displayName.length > 15
        ? displayName.substring(0, 15) + '...'
        : displayName;

    // Add all participants - Mermaid doesn't support conditional styling through syntax
    // Instead, we'll just include all participants consistently
    result += `    participant ${safeVatId} as "${truncatedName}"\n`;
  });

  // Add system participant if needed anywhere in the diagram
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
  vats.forEach((vat) => {
    vatIds.add(vat.vatID);
  });

  // Add interactions with logical break markers
  interactions.forEach((interaction, index) => {
    const { sourceVat, targetVat, method, type, time } = interaction;

    // Skip if missing source or target
    if (!sourceVat || !targetVat) return;

    // Format timestamp (for debugging or future use)
    // const formattedTime = new Date(time * (time > 10000000000 ? 1 : 1000))
    //   .toISOString().replace('T', ' ').substring(0, 19);

    // Handle the syscall case specially
    if (type === 'syscall' && vatIds.has(sourceVat)) {
      // For syscalls to external targets
      if (!vatIds.has(targetVat) && targetVat !== 'system') {
        // Extract target name from the format 'target:name'
        const externalName = targetVat.startsWith('target:')
          ? targetVat.substring(7)
          : targetVat;

        // Sanitize source vat ID for Mermaid
        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;

        // Format method with target name
        const methodDisplay =
          method && method.length > 15
            ? `${method.substring(0, 15)}... (${externalName.substring(0, 15)})`
            : `${method || 'unknown'} (${externalName.substring(0, 15)})`;

        // Use 'x' arrow for external calls
        result += `    ${safeSourceVat}-x>External: ${methodDisplay}\n`;
      }
      // For syscalls between vats (rare, but could happen)
      else if (vatIds.has(targetVat)) {
        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
        const safeTargetVat = `Vat_${targetVat.replace(/[^\w]/g, '_')}`;

        const methodDisplay =
          method && method.length > 20
            ? `${method.substring(0, 20)}...`
            : method || 'unknown';

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
      let methodDisplay =
        method && method.length > 25
          ? method.substring(0, 25) + '...'
          : method || 'unknown';

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
        result += `    Note over System: Time gap (${Math.floor(
          timeGap
        )} seconds)\n`;
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

const Neo4jSequenceDiagram = ({ onDiagramGenerated }) => {
  const [startTime, setStartTime] = useState('1629570627.218393'); // Default start time
  const [endTime, setEndTime] = useState('1829570627.218393'); // Default end time
  const [interactionsPerPage, setInteractionsPerPage] = useState(20);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  // Check API health on component mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const data = await api.checkHealth();
        setConnectionStatus('API server connected to Neo4j database');
      } catch (error) {
        console.error(error);
        setConnectionStatus('Warning: Cannot connect to API server');
      }
    };

    checkApiHealth();
  }, []);

  // Function to fetch data from our API
  const fetchData = async () => {
    setIsLoading(true);
    setStatus('Fetching data from server...');

    try {
      // Parse Unix timestamps
      const startTimestamp = parseTimestamp(startTime) ?? 0;
      const endTimestamp =
        parseTimestamp(endTime) ?? Math.floor(Date.now() / 1000); // Default to now

      // Fetch vats and interactions in parallel
      const [vats, interactionsData] = await Promise.all([
        api.getVats(),
        api.getInteractions(startTimestamp, endTimestamp),
      ]);

      const allInteractions = interactionsData.interactions;

      // Process and sanitize interactions
      const processedInteractions = api.sanitizeInteractions(allInteractions);

      // Generate the Mermaid diagram with pagination
      setStatus(
        `Found ${processedInteractions.length} interactions. Generating diagram...`
      );
      const diagram = generateMermaidSequenceDiagram(
        processedInteractions,
        vats,
        interactionsPerPage
      );
      onDiagramGenerated(diagram);

      // Calculate pages for status message
      const pageCount = Math.ceil(
        processedInteractions.length / interactionsPerPage
      );
      const pagesInfo = pageCount > 1 ? ` Split into ${pageCount} pages.` : '';

      setStatus(
        `Diagram generated successfully with ${processedInteractions.length} interactions between ${vats.length} vats.${pagesInfo}`
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='neo4j-form'>
      <h3>Generate Sequence Diagram</h3>

      {connectionStatus && (
        <div
          className={`connection-status ${
            connectionStatus.includes('Warning') ? 'warning' : 'success'
          }`}>
          <div className='status-indicator'></div>
          <span>{connectionStatus}</span>
        </div>
      )}

      <div className='form-group'>
        <label>Start Time (Unix timestamp):</label>
        <div className='input-with-actions'>
          <input
            type='text'
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder='1629570627.218393'
          />
          <button
            className='input-action-button'
            onClick={() => setStartTime('1629570627.218393')}
            title='Reset to default start time'>
            Reset
          </button>
        </div>
        <small className='form-text'>
          Default start time is pre-filled for convenience
        </small>
      </div>

      <div className='form-group'>
        <label>End Time (Unix timestamp):</label>
        <div className='input-with-actions'>
          <input
            type='text'
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder='1829570627.218393'
          />
          <button
            className='input-action-button'
            onClick={() => setEndTime('1829570627.218393')}
            title='Reset to default end time'>
            Reset
          </button>
        </div>
        <small className='form-text'>
          Default end time is pre-filled for convenience
        </small>
      </div>

      <div className='form-group'>
        <label>Interactions Per Page:</label>
        <input
          type='number'
          min='5'
          max='50'
          value={interactionsPerPage}
          onChange={(e) =>
            setInteractionsPerPage(
              Math.max(5, Math.min(50, parseInt(e.target.value) || 20))
            )
          }
          placeholder='20'
        />
        <small className='form-text'>
          Number of interactions to show per page (5-50). Use lower values for
          better readability.
        </small>
      </div>

      <button onClick={fetchData} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Generate Diagram'}
      </button>

      {status && (
        <div
          className={`status-message ${
            status.includes('error') || status.includes('Error') ? 'error' : ''
          }`}>
          {status}
        </div>
      )}

      <div className='troubleshooting'>
        <h4>Troubleshooting</h4>
        <ul>
          <li>
            Make sure the API server is running (default:{' '}
            <code>http://localhost:3001</code>)
          </li>
          <li>The backend server manages the Neo4j connection securely</li>
          <li>
            Times in the database are Unix timestamps (e.g., 1629570627.218393)
          </li>
          <li>
            Try adjusting the "Interactions Per Page" value to break diagrams
            into manageable pages
          </li>
          <li>If you encounter errors, check the server logs for details</li>
        </ul>
      </div>
    </div>
  );
};

export default Neo4jSequenceDiagram;
