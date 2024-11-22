// @ts-check
import { fetchGCPLogs } from './fetchGCPLogs.js';
import {
  fetchLogsForBatch,
  findEntryWithTimestamp,
  getTimestampsForBatch,
} from '../helpers/utils.js';
import { fs } from 'zx';

const BATCH_SIZE = 10; // 10 days

const calculateDaysDifference = (startTimestamp) => {
  const startTime = new Date(startTimestamp);
  const currentDate = new Date();

  console.log(`Calculating days difference...`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`Current Time: ${currentDate.toISOString()}`);

  const timeDifference = currentDate.getTime() - startTime.getTime();
  console.log(`Time Difference in Milliseconds: ${timeDifference}`);

  const daysDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));
  console.log(`Days since START_BLOCK_EVENT_TYPE: ${daysDifference} days`);

  return daysDifference;
};

const fetchLogsByBlockEvents = async ({
  network,
  blockHeight,
  type,
  totalDaysCoverage = 90,
}) => {
  try {
    console.log(`***** Fetching data for event: ${type} *****`);

    let promises = [];

    for (
      let batchStartIndex = 0;
      batchStartIndex < totalDaysCoverage;
      batchStartIndex += BATCH_SIZE
    ) {
      const { startTime, endTime } = getTimestampsForBatch(
        batchStartIndex,
        totalDaysCoverage
      );
      console.log(`Fetching logs for ${startTime} to ${endTime}`);

      const searchQuery = `jsonPayload.blockHeight="${blockHeight}"`;

      promises.push(
        fetchLogsForBatch({
          network,
          searchQuery,
          startTime,
          endTime,
          type,
        })
      );
    }

    const logs = await Promise.all(promises);

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
