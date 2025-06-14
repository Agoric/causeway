import { useState, useEffect } from 'react';
import {
  checkHealth,
  getVats,
  getInteractions,
  sanitizeInteractions,
} from 'services/api';
import { generateMermaidSequenceDiagram, parseTimestamp } from 'helpers';

type Props = {
  onDiagramGenerated: (diagramCode: string) => void;
};
const Neo4jSequenceDiagram = ({ onDiagramGenerated }: Props) => {
  const now = Date.now() / 1000; // Current Unix timestamp in seconds (with decimals)
  const [startTime, setStartTime] = useState('1747926115.295377');
  const [endTime, setEndTime] = useState(now.toString()); // now
  const [interactionsPerPage, setInteractionsPerPage] = useState(20);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  // Check API health on component mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        // TODO
        await checkHealth();
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
        getVats(),
        getInteractions(startTimestamp, endTimestamp),
      ]);

      const allInteractions = interactionsData.interactions;

      // Process and sanitize interactions
      const processedInteractions = sanitizeInteractions(allInteractions);

      // Generate the Mermaid diagram with pagination
      setStatus(
        `Found ${processedInteractions.length} interactions. Generating diagram...`,
      );
      const diagram = generateMermaidSequenceDiagram(
        processedInteractions,
        vats,
        interactionsPerPage,
      );
      onDiagramGenerated(diagram);

      // Calculate pages for status message
      const pageCount = Math.ceil(
        processedInteractions.length / interactionsPerPage,
      );
      const pagesInfo = pageCount > 1 ? ` Split into ${pageCount} pages.` : '';

      setStatus(
        `Diagram generated successfully with ${processedInteractions.length} interactions between ${vats.length} vats.${pagesInfo}`,
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="neo4j-form">
      <h3>Generate Sequence Diagram</h3>

      {connectionStatus && (
        <div
          className={`connection-status ${
            connectionStatus.includes('Warning') ? 'warning' : 'success'
          }`}
        >
          <div className="status-indicator"></div>
          <span>{connectionStatus}</span>
        </div>
      )}

      <div className="form-group">
        <label>Start Time (Unix timestamp):</label>
        <div className="input-with-actions">
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="1629570627.218393"
          />
          <button
            className="input-action-button"
            onClick={() => setStartTime('1629570627.218393')}
            title="Reset to default start time"
          >
            Reset
          </button>
        </div>
        <small className="form-text">
          Default start time is pre-filled for convenience
        </small>
      </div>

      <div className="form-group">
        <label>End Time (Unix timestamp):</label>
        <div className="input-with-actions">
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="1829570627.218393"
          />
          <button
            className="input-action-button"
            onClick={() => setEndTime('1829570627.218393')}
            title="Reset to default end time"
          >
            Reset
          </button>
        </div>
        <small className="form-text">
          Default end time is pre-filled for convenience
        </small>
      </div>

      <div className="form-group">
        <label>Interactions Per Page:</label>
        <input
          type="number"
          min="5"
          max="50"
          value={interactionsPerPage}
          onChange={(e) =>
            setInteractionsPerPage(
              Math.max(5, Math.min(50, parseInt(e.target.value) || 20)),
            )
          }
          placeholder="20"
        />
        <small className="form-text">
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
          }`}
        >
          {status}
        </div>
      )}

      <div className="troubleshooting">
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
            Try adjusting the &quot;Interactions Per Page&quot; value to break
            diagrams into manageable pages
          </li>
          <li>If you encounter errors, check the server logs for details</li>
        </ul>
      </div>
    </div>
  );
};

export default Neo4jSequenceDiagram;
