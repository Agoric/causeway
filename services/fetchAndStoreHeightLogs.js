// @ts-check
import { fetchGCPLogs } from './fetchGCPLogs.js';
import {
  findEntryWithTimestamp,
  calculateDaysDifference,
  fetchLogsInBatches,
} from '../helpers/utils.js';
import { fs } from 'zx';

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

    console.log(
      `Start time of block ${blockHeight}: ${foundBeginBlock.timestamp}`
    );
    const totalDaysCoverage = calculateDaysDifference(
      foundBeginBlock.timestamp
    );

    const foundCommitBlockFinish = await fetchLogsByBlockEvents({
      network,
      blockHeight,
      type: COMMIT_BLOCK_FINISH_EVENT_TYPE,
      totalDaysCoverage,
    });

    if (!foundCommitBlockFinish) {
      throw Error(
        `No log entry found for event ${COMMIT_BLOCK_FINISH_EVENT_TYPE} at block height ${blockHeight}`
      );
    }

    const startTime = foundBeginBlock.timestamp;
    const endTime = foundCommitBlockFinish.timestamp;

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
