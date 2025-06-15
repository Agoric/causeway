import { useRouter, useSearchParams } from 'next/navigation';
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
  const now = Date.now() / 1000;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<{
    blockHeight: string;
    connectionHealthy: boolean;
    endTime: string;
    formDisabled: boolean;
    interactionsPerPage: number;
    startTime: string;
    status: string;
  }>({
    blockHeight: '',
    connectionHealthy: false,
    endTime: '',
    formDisabled: true,
    interactionsPerPage: 20,
    startTime: '',
    status: '',
  });

  const fetchData = async () => {
    setState((prevState) => ({
      ...prevState,
      formDisabled: true,
      status: 'Fetching data from server...',
    }));

    try {
      const blockHeight = searchParams.get('blockHeight');
      const startTimestamp = parseTimestamp(searchParams.get('startTime')) ?? 0;
      const endTimestamp =
        parseTimestamp(searchParams.get('endTime')) ?? Math.floor(now);

      const [vats, interactionsData] = await Promise.all([
        getVats({
          blockHeight: Number(blockHeight),
          endTime: endTimestamp,
          startTime: startTimestamp,
        }),
        getInteractions({
          blockHeight: Number(blockHeight),
          endTime: endTimestamp,
          startTime: startTimestamp,
        }),
      ]);

      const allInteractions = interactionsData.interactions;

      const processedInteractions = sanitizeInteractions(allInteractions);

      const diagram = generateMermaidSequenceDiagram(
        processedInteractions,
        vats,
        state.interactionsPerPage,
      );
      onDiagramGenerated(diagram);

      const pageCount = Math.ceil(
        processedInteractions.length / state.interactionsPerPage,
      );
      const pagesInfo = pageCount > 1 ? ` Split into ${pageCount} pages.` : '';

      setState((prevState) => ({
        ...prevState,
        status: `Diagram generated successfully with ${processedInteractions.length} interactions between ${vats.length} vats.${pagesInfo}`,
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
      setState((prevState) => ({
        ...prevState,
        status: `Error: ${error.message}`,
      }));
    } finally {
      setState((prevState) => ({
        ...prevState,
        formDisabled: false,
      }));
    }
  };

  const getSanitizedInteractionsPerPage = (
    interactionsPerPage: string | null,
  ) => Math.max(5, Math.min(50, Number(interactionsPerPage) || 20));

  useEffect(() => {
    if (!state.connectionHealthy) return;

    setState((prevState) => ({
      ...prevState,
      blockHeight: searchParams.get('blockHeight') || '',
      endTime: searchParams.get('endTime') || '',
      interactionsPerPage: getSanitizedInteractionsPerPage(
        searchParams.get('interactionsPerPage'),
      ),
      startTime: searchParams.get('startTime') || '',
    }));
    fetchData();
  }, [searchParams, state.connectionHealthy]);

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        await checkHealth();
        setState((prevState) => ({
          ...prevState,
          connectionHealthy: true,
          formDisabled: false,
          status: 'API server connected to Neo4j database',
        }));
      } catch (error) {
        console.error(error);
        setState((prevState) => ({
          ...prevState,
          connectionHealthy: false,
          formDisabled: true,
          status: 'Warning: Cannot connect to API server',
        }));
      }
    };

    checkApiHealth();
  }, []);

  return (
    <div className="neo4j-form">
      <h3>Generate Sequence Diagram</h3>

      <div className="form-group">
        <label>Block Height:</label>
        <div className="input-with-actions">
          <input
            onChange={({ target: { value: blockHeight } }) =>
              (!blockHeight || Number(blockHeight)) &&
              setState((prevState) => ({ ...prevState, blockHeight }))
            }
            type="text"
            value={state.blockHeight}
          />
        </div>
        <small className="form-text">
          Default start time is pre-filled for convenience
        </small>
      </div>

      <div className="form-group">
        <label>Start Time (Unix timestamp):</label>
        <div className="input-with-actions">
          <input
            onChange={({ target: { value: startTime } }) =>
              (!startTime || Number(startTime)) &&
              setState((prevState) => ({ ...prevState, startTime }))
            }
            value={state.startTime}
            type="text"
          />
        </div>
        <small className="form-text">
          Default start time is pre-filled for convenience
        </small>
      </div>

      <div className="form-group">
        <label>End Time (Unix timestamp):</label>
        <div className="input-with-actions">
          <input
            onChange={({ target: { value: endTime } }) =>
              (!endTime || Number(endTime)) &&
              setState((prevState) => ({ ...prevState, endTime }))
            }
            value={state.endTime}
            type="text"
          />
        </div>
        <small className="form-text">
          Default end time is pre-filled for convenience
        </small>
      </div>

      <div className="form-group">
        <label>Interactions Per Page:</label>
        <input
          max="50"
          min="5"
          onChange={({ target: { value: interactionsPerPage } }) =>
            setState((prevState) => ({
              ...prevState,
              interactionsPerPage:
                getSanitizedInteractionsPerPage(interactionsPerPage),
            }))
          }
          type="number"
          value={state.interactionsPerPage}
        />
        <small className="form-text">
          Number of interactions to show per page (5-50). Use lower values for
          better readability.
        </small>
      </div>

      <button
        onClick={() =>
          router.push(
            `/?blockHeight=${state.blockHeight}&endTime=${state.endTime}&interactionsPerPage=${state.interactionsPerPage}&startTime=${state.startTime}`,
          )
        }
        disabled={state.formDisabled}
      >
        {state.formDisabled ? 'Loading...' : 'Generate Diagram'}
      </button>

      {state.status && (
        <div
          className={`status-message ${
            state.status.includes('error') || state.status.includes('Error')
              ? 'error'
              : ''
          }`}
        >
          {state.status}
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
