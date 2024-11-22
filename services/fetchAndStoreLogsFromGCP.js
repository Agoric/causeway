// @ts-check
import { fs } from 'zx';
import { fetchLogs } from '../helpers/utils.js';
import { ADDITIONAL_QUERY_FILTERS } from '../helpers/constants.js';

export const fetchAndStoreLogsFromGCP = async ({
  startTime,
  endTime,
  inputFile,
  network,
  queryfilter = '',
}) => {
  try {
    let allEntries = [];

    const searchQuery = `
      ${queryfilter}
      ${ADDITIONAL_QUERY_FILTERS}
    `;

    const entries = await fetchLogs({
      startTime,
      endTime,
      searchQuery,
      network,
    });

    if (!entries) {
      throw Error('No Entries found for the given date');
    }

    console.log('Fetched page size: ' + entries.length);
    allEntries = allEntries.concat(entries);

    const logEntries = allEntries.map((entry) => {
      return JSON.stringify(entry.data);
    });

    fs.writeFile(inputFile, logEntries.join('\n'), (err) => {
      if (err) {
        console.error('Error writing to file:', err);
      } else {
        console.log('Logs successfully stored in:', inputFile);
      }
    });

    return true;
  } catch (error) {
    console.error(error.message);
    console.error('Stack trace:', error.stack);
  }
};
