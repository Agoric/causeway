// @ts-check
import { fs } from 'zx';
import { fetchGCPLogs } from './fetchGCPLogs.js';

export const fetchAndStoreLogsFromGCP = async ({
  startTime,
  endTime,
  inputFile,
  queryfilter = '',
}) => {
  try {
    let allEntries = [];

    const { entries } = await fetchGCPLogs({
      startTime,
      endTime,
      filter: queryfilter,
      pageSize: 1000,
    });

    if (!entries) {
      throw Error('No Entries found for the given date');
    }

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

    return true;
  } catch (error) {
    console.error(error.message);
    console.error('Stack trace:', error.stack);
  }
};
