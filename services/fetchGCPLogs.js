// @ts-check
import { Logging } from '@google-cloud/logging';
import { getCredentials } from '../helpers/getGCPCredentials.js';
import { formatDateString } from '../helpers/utils.js';

const ADDITIONAL_FILTERS = `
    (
        jsonPayload.type = "create-vat" OR 
        jsonPayload.type = "cosmic-swingset-end-block-start" OR 
        jsonPayload.type = "deliver" OR 
        jsonPayload.type = "deliver-result" OR 
        jsonPayload.type = "syscall"
    )
`;

/**
 * Fetches logs from Google Cloud Platform based on the specified time range and filter criteria.
 *
 * @param {Object} params - The parameters for fetching logs.
 * @param {string} params.endTime - The end time for the log entries to fetch, in ISO format.
 * @param {string} params.startTime - The start time for the log entries to fetch, in ISO format.
 * @param {string} [params.filter=''] - Additional filter string for querying logs. Defaults to an empty string.
 * @param {number} [params.pageSize] - The maximum number of log entries to return per page, or `undefined` for no specific page size limit.
 * @returns {Promise<Array>} A promise that resolves to an array of log entries.
 */
export const fetchGCPLogs = async ({
  endTime,
  startTime,
  filter = '',
  pageSize = undefined,
}) => {
  const queryfilter = `
  ${filter} AND
  ${ADDITIONAL_FILTERS}
  timestamp >= "${formatDateString(startTime)}" 
  AND timestamp <= "${formatDateString(endTime)}"
    `;

  const projectId = getCredentials().project_id;
  const logging = new Logging({ projectId });
  const entries = await logging.getEntries({
    filter: queryfilter,
    pageSize,
  });

  return entries;
};
