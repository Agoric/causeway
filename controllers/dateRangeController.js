// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndStoreLogsFromGCP } from '../services/fetchAndStoreLogsFromGCP.js';
import { processAndConvert } from '../services/fileProcessor.js';
import { formatDateString } from '../helpers/utils.js';
import { networks } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const handleDateRange = async (req, res) => {
  const { startDate, network } = req.body;
  if (!startDate) {
    return res.status(400).json({ message: 'Start date is required.' });
  }

  if (!network || !networks[network]) {
    return res.status(400).json({ error: 'Bad Request: Network not found' });
  }

  console.log(`startDate:${startDate} AND AGORIC_NET:${network}`);

  const inputFile = path.join(
    __dirname,
    '..',
    `${uploadDir}/${uniqueSuffix}.json`
  );

  const formattedStartDate = formatDateString(startDate);
  let endDate = new Date(startDate);
  endDate.setSeconds(endDate.getSeconds() + 20); // Add 20 seconds
  const formattedEndDate = formatDateString(endDate);

  console.log(
    `FormattedStartDate:${formattedStartDate} FormattedEndDate:${formattedEndDate}`
  );

  const queryfilter = `
    resource.labels.container_name="${networks[network].container_name}" AND
    resource.labels.cluster_name="${networks[network].cluster_name}" AND
    resource.labels.namespace_name="${networks[network].namespace_name}" AND
    resource.labels.pod_name="${networks[network].pod_name}" AND
  `;

  console.log(`Fetching data from GCP for...`);
  await fetchAndStoreLogsFromGCP({
    startTime: formattedStartDate,
    endTime: formattedEndDate,
    inputFile,
    queryfilter,
  });
  await processAndConvert({ inputFile, res });
};
