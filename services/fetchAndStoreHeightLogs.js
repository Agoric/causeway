// @ts-check
import {
  findEntryWithTimestamp,
  calculateDaysDifference,
  fetchLogsInBatches,
  fetchLogs,
} from '../helpers/utils.js';
import { fs } from 'zx';
import { ADDITIONAL_QUERY_FILTERS } from '../helpers/constants.js';

const fetchLogsByBlockEvents = async ({
  network,
  blockHeight,
  type,
  totalDaysCoverage = 90,
}) => {
  try {
    console.log(`***** Fetching data for event: ${type} *****`);

    const searchQuery = `
    jsonPayload.type="${type}" AND
    jsonPayload.blockHeight="${blockHeight}"`;

    const logs = await fetchLogsInBatches({
      network,
      searchQuery,
      batchSize: 10,
      totalDaysCoverage,
    });

    return findEntryWithTimestamp(logs);
  } catch (error) {
    console.error(error);
  }
};

export const fetchAndStoreHeightLogs = async ({
  blockHeight,
  inputFile,
  network,
}) => {
  try {
    console.log(
      `***** Fetching data for height:${blockHeight} and network: ${network} *****`
    );

    const START_BLOCK_EVENT_TYPE = 'cosmic-swingset-begin-block';
    const COMMIT_BLOCK_FINISH_EVENT_TYPE =
      'cosmic-swingset-commit-block-finish';

    const [foundBeginBlock, foundCommitBlockFinish] = await Promise.all([
      fetchLogsByBlockEvents({
        network,
        blockHeight,
        type: START_BLOCK_EVENT_TYPE,
      }),
      fetchLogsByBlockEvents({
        network,
        blockHeight,
        type: COMMIT_BLOCK_FINISH_EVENT_TYPE,
      }),
    ]);

    if (!foundBeginBlock || !foundCommitBlockFinish) {
      const missingEventType = !foundBeginBlock
        ? START_BLOCK_EVENT_TYPE
        : COMMIT_BLOCK_FINISH_EVENT_TYPE;

      throw Error(
        `No log entry found for event ${missingEventType} at block height ${blockHeight}`
      );
    }

    const startTime = foundBeginBlock.timestamp;
    const endTime = foundCommitBlockFinish.timestamp;

    console.log(`Start time of block ${blockHeight}: ${startTime}`);
    console.log(`End time of block ${blockHeight}: ${endTime}`);

    let allEntries = [];

    const searchQuery = `
    ${ADDITIONAL_QUERY_FILTERS}  
    `;

    const entries = await fetchLogs({
      startTime,
      endTime,
      searchQuery,
      network,
    });

    console.log('Fetched page size: ' + entries.length);
    allEntries = allEntries.concat(entries);

    const logEntries = allEntries.map((entry) => {
      return JSON.stringify(entry.data);
    });

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
