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

    let endDateObj = new Date(startDate);
    endDateObj.setSeconds(endDateObj.getSeconds() + 20); // Add 10 seconds
    const formattedEndDate = formatDateString(endDateObj);

    console.log(
      `FormattedStartDate:${formattedStartDate} FormattedEndDate:${formattedEndDate}`
    );

    const filter = `
    timestamp >= "${formattedStartDate}" AND 
    timestamp <= "${formattedEndDate}" AND 
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

    let nextPageToken = null;
    let allEntries = [];

    do {
      const options = {
        filter: filter,
        pageSize: 1000,
        pageToken: nextPageToken,
      };

      const [entries, _, { nextPageToken: _newPageToken }] =
        await logging.getEntries(options);
      console.log('Fetched page size: ' + entries.length);
      allEntries = allEntries.concat(entries);
      nextPageToken = null;
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
