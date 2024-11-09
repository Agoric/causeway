// @ts-check
import { getAccessToken } from '../helpers/getAccessToken.js';
import { networks } from '../helpers/constants.js';
import { getCredentials } from '../helpers/getGCPCredentials.js';
import { fetchGCPLogs } from './fetchGCPLogs.js';
import { fs } from 'zx';

const scopes = ['https://www.googleapis.com/auth/logging.read'];

const getTimestampsForBatch = (batchStart, batchSize) => {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - batchStart);

  const endTime = new Date(startTime);
  endTime.setDate(startTime.getDate() + batchSize);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
};
const fetchLogsForBatch = async ({
  accessToken,
  projectId,
  network,
  blockHeight,
  startTime,
  endTime,
  type,
}) => {
  const filter = `
    resource.labels.container_name="${networks[network].container_name}" AND
    resource.labels.cluster_name="${networks[network].cluster_name}" AND
    resource.labels.namespace_name="${networks[network].namespace_name}" AND
    resource.labels.pod_name="${networks[network].pod_name}" AND
    resource.type="k8s_container"

      
    jsonPayload.type="${type}"
    jsonPayload.blockHeight="${blockHeight}"

    timestamp >= "${startTime}" AND timestamp <= "${endTime}"
    
  `;

  const LOG_ENTRIES_ENDPOINT = 'https://logging.googleapis.com/v2/entries:list';

  const body = {
    filter,
    orderBy: 'timestamp asc',
    resourceNames: ['projects/' + projectId],
    pageSize: 1,
  };

  const response = await fetch(LOG_ENTRIES_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Error fetching logs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entries || [];
};

const fetchLogsByBlockEvents = async ({ network, blockHeight, type }) => {
  try {
    console.log(`***** Fetching data for event: ${type} *****`);

    const accessToken = await getAccessToken(scopes);

    const maxDays = 90;
    const batchSize = 10; // 10 Days
    let promises = [];

    for (let i = 1; i < maxDays; i += batchSize) {
      let batchStart;

      if (i == 1) {
        batchStart = batchSize;
      } else {
        batchStart = i - 1 + batchSize;
      }

      const { startTime, endTime } = getTimestampsForBatch(
        batchStart,
        batchSize
      );
      console.log(`Fetching logs for ${startTime} to ${endTime}`);

      const projectId = getCredentials().project_id;

      promises.push(
        fetchLogsForBatch({
          accessToken,
          projectId,
          network,
          blockHeight,
          startTime,
          endTime,
          type,
        })
      );
    }

    const logs = await Promise.any(promises);

    return logs?.[0] || null;
  } catch (error) {
    console.error(error);
  }
};

export const fetchAndStoreHeightLogs = async ({
  blockHeight,
  inputFile,
  queryfilter = '',
  network,
}) => {
  try {
    console.log(
      `***** Fetching data for height:${blockHeight} and network: ${network} *****`
    );

    const START_BLOCK_EVENT_TYPE = 'cosmic-swingset-begin-block';
    const COMMIT_BLOCK_FINISH_EVENT_TYPE =
      'cosmic-swingset-commit-block-finish';

    const foundBeginBlock = await fetchLogsByBlockEvents({
      network,
      blockHeight,
      type: START_BLOCK_EVENT_TYPE,
    });

    if (!foundBeginBlock) {
      throw Error(
        `No log entry found for event ${START_BLOCK_EVENT_TYPE} at block height ${blockHeight}`
      );
    }

    const foundCommitBlockFinish = await fetchLogsByBlockEvents({
      network,
      blockHeight,
      type: COMMIT_BLOCK_FINISH_EVENT_TYPE,
    });

    if (!foundCommitBlockFinish) {
      throw Error(
        `No log entry found for event ${COMMIT_BLOCK_FINISH_EVENT_TYPE} at block height ${blockHeight}`
      );
    }

    const startTime = foundBeginBlock.timestamp;
    const endTime = foundCommitBlockFinish.timestamp;

    console.log(`Start time of block ${blockHeight}: ${startTime}`);
    console.log(`End time of block ${blockHeight}: ${endTime}`);

    let allEntries = [];

    const { entries } = await fetchGCPLogs({
      startTime,
      endTime,
      filter: queryfilter,
      pageSize: 1000,
    });

    console.log('Fetched page size: ' + entries.length);
    allEntries = allEntries.concat(entries);

    const logEntries = allEntries.map((entry) =>
      JSON.stringify(entry.jsonPayload)
    );

    if (!logEntries) {
      throw Error('No Entries found for the given Height');
    }

    fs.writeFile(inputFile, logEntries.join('\n'), (err) => {
      if (err) {
        console.error('Error writing to file:', err);
      } else {
        console.log('Logs successfully stored in:', inputFile);
      }
    });
  } catch (error) {
    console.error(error.message);
    console.error('Stack trace:', error.stack);
  }
};
