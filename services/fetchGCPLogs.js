// @ts-check
import { serviceAccount, accessToken } from '../helpers/credentials.js';

const LOG_ENTRIES_ENDPOINT = 'https://logging.googleapis.com/v2/entries:list';
const COMMIT_BLOCK_FINISH_EVENT_TYPE = 'cosmic-swingset-commit-block-finish';
const ADDITIONAL_FILTERS = `
    resource.labels.container_name="log-slog" AND
    resource.labels.cluster_name="puffynet" AND
    resource.labels.namespace_name="followmain" AND
    resource.labels.pod_name="follower-0" AND
    (
        jsonPayload.type = "create-vat" OR 
        jsonPayload.type = "cosmic-swingset-end-block-start" OR 
        jsonPayload.type = "deliver" OR 
        jsonPayload.type = "deliver-result" OR 
        jsonPayload.type = "syscall"
    )
`;

/**
 * @typedef {{
* insertId: string;
* jsonPayload: {
*   blockHeight: number;
*   blockTime: number;
*   monotime: number;
*   type: typeof COMMIT_BLOCK_FINISH_EVENT_TYPE;
* };
* labels: {
*   'compute.googleapis.com/resource_name': string;
*   'k8s-pod/app': string;
*   'k8s-pod/apps_kubernetes_io/pod-index': string;
*   'k8s-pod/controller-revision-hash': string;
*   'k8s-pod/grouplb': string;
*   'k8s-pod/statefulset_kubernetes_io/pod-name': string;
* };
* logName: string;
* receiveTimestamp: string;
* resource: {
*   labels: {
*     cluster_name: string;
*     container_name: string;
*     location: string;
*     namespace_name: string;
*     pod_name: string;
*     project_id: string;
*   };
*   type: string;
* };
* severity: string;
* timestamp: string;
* }} LogEntry
*

/**
 * Queries log entries within a specified time range and optional filters.
 *
 * @param {Object} params - The query parameters.
 * @param {string} params.endTime - The end time for the log query in ISO format.
 * @param {string} params.startTime - The start time for the log query in ISO format.
 * @param {string} [params.filter=''] - Optional filter to narrow down log entries.
 * @param {number} [params.pageSize] - Optional number of entries to retrieve per page.
 * @param {string} [params.pageToken] - Optional token for pagination.
 * @returns {Promise<{entries: Array<LogEntry>, nextPageToken?: string}>} - A promise that resolves with log entries and an optional token for the next page.
 */
export const fetchGCPLogs = async ({
  endTime,
  startTime,
  filter = '',
  pageSize = undefined,
  pageToken = undefined,
}) => {
  const fullFilter = `
  ${ADDITIONAL_FILTERS}
  ${filter}
  timestamp >= "${startTime}" AND timestamp <= "${endTime}"
    `;

  const body = {
    filter: fullFilter,
    orderBy: 'timestamp asc',
    pageSize,
    pageToken,
    resourceNames: ['projects/' + serviceAccount.project_id],
  };

  const response = await fetch(LOG_ENTRIES_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok)
    throw Error(`Failed to query logs due to error: ${await response.text()}`);

  return await response.json();
};
