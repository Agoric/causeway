import { Logging } from '@google-cloud/logging';
import { formatDateString } from '../helpers/utils.js';
import { fs } from 'zx';

export const fetchAndStoreLogsFromGCP = async ({
  startDate,
  endDate,
  inputFile,
}) => {
  try {
    console.log(
      `startDate:${startDate} endDate:${endDate} inputFile:${inputFile}`
    );

    const logging = new Logging();
    const formattedStartDate = formatDateString(startDate);
    const formattedEndDate = formatDateString(endDate);

    console.log(
      `FormattedStartDate:${formattedStartDate} FormattedEndDate:${formattedEndDate}`
    );

    const filter = `timestamp >= "${formattedStartDate}" AND timestamp <= "${formattedEndDate}"`;

    let nextPageToken = null;
    let allEntries = [];

    do {
      const options = {
        filter: filter,
        pageSize: 100,
        pageToken: nextPageToken,
      };

      const [entries, { nextPageToken: newPageToken }] =
        await logging.getEntries(options);
      allEntries = allEntries.concat(entries);
      nextPageToken = newPageToken;
    } while (nextPageToken);

    const logEntries = allEntries.map((entry) => JSON.stringify(entry.data));

    fs.writeFile(inputFile, logEntries.join('\n'), (err) => {
      if (err) {
        console.error('Error writing to file:', err);
      } else {
        console.log('Logs successfully stored in:', inputFile);
      }
    });
  } catch (error) {
    console.error('Error fetching logs from GCP:', error.message);
    console.error('Stack trace:', error.stack);
  }
};
