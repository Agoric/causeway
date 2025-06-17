import { useRouter, useSearchParams } from 'next/navigation';
import { useContext, useState, useEffect } from 'react';
import { Context as InteractionContext } from 'context/interactions';
import {
  checkHealth,
  getVats,
  getInteractions,
  sanitizeInteractions,
} from 'services/api';
import { getSanitizedInteractionsPerPage, parseTimestamp } from 'helpers';

const EXTRACT_VAT_ID_REGEX = /^v([0-9]*)$/;

const FORM_GROUP_CLASSES = 'flex flex-col gap-y-1';
const FORM_HELP_CLASSES = 'text-gray-D600 text-xs';
const FORM_INPUT_CLASSES =
  'border border-gray-L300 border-solid no-outline p-2 rounded-sm w-full';
const FORM_LABEL_CLASSES = 'font-bold';

const Neo4jSequenceDiagram = () => {
  const now = Date.now() / 1000;
  const { setData } = useContext(InteractionContext);
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

  const routerBlockHeight = searchParams.get('blockHeight') || '';
  const routerEndTime = searchParams.get('endTime') || '';
  const routerInteractionsPerPage =
    searchParams.get('interactionsPerPage') || '';
  const routerStartTime = searchParams.get('startTime') || '';

  const fetchData = async () => {
    setState((prevState) => ({
      ...prevState,
      formDisabled: true,
      status: 'Fetching data from server...',
    }));

    try {
      const blockHeight = searchParams.get('blockHeight');
      const endTimestamp =
        parseTimestamp(searchParams.get('endTime')) ?? Math.floor(now);
      const interactionsPerPage = getSanitizedInteractionsPerPage(
        routerInteractionsPerPage,
      );
      const startTimestamp = parseTimestamp(searchParams.get('startTime')) ?? 0;

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
      setData(
        processedInteractions,
        vats.sort(
          ({ vatID: firstVatID }, { vatID: secondVatID }) =>
            Number(EXTRACT_VAT_ID_REGEX.exec(firstVatID)![1]) -
            Number(EXTRACT_VAT_ID_REGEX.exec(secondVatID)![1]),
        ),
      );

      const pageCount = Math.ceil(
        processedInteractions.length / interactionsPerPage,
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

  useEffect(() => {
    if (!state.connectionHealthy) return;

    setState((prevState) => ({
      ...prevState,
      blockHeight: routerBlockHeight,
      endTime: routerEndTime,
      interactionsPerPage: getSanitizedInteractionsPerPage(
        routerInteractionsPerPage,
      ),
      startTime: routerStartTime,
    }));
    fetchData();
  }, [
    routerBlockHeight,
    routerEndTime,
    routerInteractionsPerPage,
    routerStartTime,
    state.connectionHealthy,
  ]);

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
    <div className="flex flex-col gap-y-3">
      <h3>Generate Sequence Diagram</h3>

      <div className={FORM_GROUP_CLASSES}>
        <p className={FORM_LABEL_CLASSES}>Block Height:</p>
        <input
          className={FORM_INPUT_CLASSES}
          onChange={({ target: { value: blockHeight } }) =>
            (!blockHeight || Number(blockHeight)) &&
            setState((prevState) => ({ ...prevState, blockHeight }))
          }
          type="text"
          value={state.blockHeight}
        />
        <span className={FORM_HELP_CLASSES}>
          Default start time is pre-filled for convenience
        </span>
      </div>

      <div className={FORM_GROUP_CLASSES}>
        <p className={FORM_LABEL_CLASSES}>Start Time (Unix timestamp):</p>
        <input
          className={FORM_INPUT_CLASSES}
          onChange={({ target: { value: startTime } }) =>
            (!startTime || Number(startTime)) &&
            setState((prevState) => ({ ...prevState, startTime }))
          }
          value={state.startTime}
          type="text"
        />
        <span className={FORM_HELP_CLASSES}>
          Default start time is pre-filled for convenience
        </span>
      </div>

      <div className={FORM_GROUP_CLASSES}>
        <p className={FORM_LABEL_CLASSES}>End Time (Unix timestamp):</p>
        <input
          className={FORM_INPUT_CLASSES}
          onChange={({ target: { value: endTime } }) =>
            (!endTime || Number(endTime)) &&
            setState((prevState) => ({ ...prevState, endTime }))
          }
          value={state.endTime}
          type="text"
        />
        <span className={FORM_HELP_CLASSES}>
          Default end time is pre-filled for convenience
        </span>
      </div>

      <div className={FORM_GROUP_CLASSES}>
        <p className={FORM_LABEL_CLASSES}>Interactions Per Page:</p>
        <input
          className={FORM_INPUT_CLASSES}
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
        <span className={FORM_HELP_CLASSES}>
          Number of interactions to show per page (5-50). Use lower values for
          better readability.
        </span>
      </div>

      <button
        className="base-button"
        onClick={() =>
          router.push(
            `/?blockHeight=${state.blockHeight}&currentPage=0&endTime=${state.endTime}&interactionsPerPage=${state.interactionsPerPage}&startTime=${state.startTime}`,
          )
        }
        disabled={state.formDisabled}
      >
        {state.formDisabled ? 'Loading...' : 'Generate Diagram'}
      </button>

      {state.status && (
        <div
          className={`border-0 border-l-4 border-solid p-2 whitespace-pre-line ${
            state.status.includes('error') || state.status.includes('Error')
              ? 'bg-red-25 border-red-500 text-red-500'
              : 'bg-gray-L50 border-blue-500'
          }`}
        >
          {state.status}
        </div>
      )}

      <div className="bg-gray-L50 flex flex-col gap-y-3 p-3 rounded-sm">
        <h4 className="font-semibold text-gray-D1200">Troubleshooting</h4>
        <ul className="pl-5 list-disc">
          <li>
            Make sure the API server is running (default:{' '}
            <code>http://localhost:3001</code>)
          </li>
          <li>The backend server manages the Neo4j connection securely</li>
          <li>
            Times in the database are Unix timestamps (e.g., 1629570627.218393)
          </li>
          <li>
            {`Try adjusting the "Interactions Per Page" value to break diagrams into manageable pages`}
          </li>
          <li>If you encounter errors, check the server logs for details</li>
        </ul>
      </div>
    </div>
  );
};

export default Neo4jSequenceDiagram;
