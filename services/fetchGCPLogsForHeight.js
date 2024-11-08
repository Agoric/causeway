// @ts-check
import { fs } from 'zx';
import { fetchGCPLogs } from './fetchGCPLogs.js';

/**
 *
 * @param {string} filter
 * @returns
 */
const searchForLogEntry = async (filter) => {
  const now = new Date();
  const maxDays = 5;
  const chunkSize = 6 * 60 * 60 * 1000; // 6 hours

  for (
    let offset = 0;
    offset < maxDays * 24 * 60 * 60 * 1000;
    offset += chunkSize
  ) {
    const endTime = new Date(now.getTime() - offset).toISOString();
    const startTime = new Date(
      now.getTime() - offset - chunkSize
    ).toISOString();

    console.log(`Searching logs between ${startTime} to ${endTime}`);
    const entry = await fetchGCPLogs({
      startTime,
      endTime,
      filter,
      pageSize: 1,
      isHeight: true,
    });

    if (entry.entries?.length) {
      return entry.entries.find(Boolean);
    }
  }

  return null;
};

export const fetchGCPLogsForHeight = async ({
  startBlockHeight,
  endBlockHeight,
  inputFile,
  queryfilter = '',
}) => {
  try {
    const START_BLOCK_EVENT_TYPE = 'cosmic-swingset-begin-block';
    const COMMIT_BLOCK_FINISH_EVENT_TYPE =
      'cosmic-swingset-commit-block-finish';

    const beginBlockFilter = `
    jsonPayload.type="${START_BLOCK_EVENT_TYPE}"
    jsonPayload.blockHeight=${startBlockHeight}
      `;

    const commitBlockFinishFilter = `
    jsonPayload.type="${COMMIT_BLOCK_FINISH_EVENT_TYPE}"
    jsonPayload.blockHeight=${endBlockHeight}
      `;

    const foundBeginBlock = await searchForLogEntry(beginBlockFilter);
    const foundCommitBlockFinish = await searchForLogEntry(
      commitBlockFinishFilter
    );

    if (!foundBeginBlock || !foundCommitBlockFinish) {
      throw Error('Could not find both log entries.');
    }

    const startTime = foundBeginBlock.timestamp;
    const endTime = foundCommitBlockFinish.timestamp;

    console.log(`Start time of block ${startBlockHeight}: ${startTime}`);
    console.log(`End time of block ${endBlockHeight}: ${endTime}`);

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
