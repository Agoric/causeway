// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndStoreLogsFromGCP } from '../services/fetchAndStoreLogsFromGCP.js';
import { processAndConvert } from '../services/fileProcessor.js';
import { cleanupFiles, formatDateString } from '../helpers/utils.js';
import { networks } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

  console.log(`Network: ${network}`);
  console.log(`Container Name: ${networks[network].container_name}`);
  console.log(`Cluster Name: ${networks[network].cluster_name}`);
  console.log(`Namespace Name: ${networks[network].namespace_name}`);
  console.log(`Pod Name: ${networks[network].pod_name}`);

  console.log(`Fetching data from GCP...`);
  const isSuccessful = await fetchAndStoreLogsFromGCP({
    startTime: formattedStartDate,
    endTime: formattedEndDate,
    inputFile,
    network,
  });

  if (!isSuccessful) {
    await cleanupFiles([inputFile]);
    return res.status(500).send('Unable to fetch logs');
  }

  await processAndConvert({ inputFile, res });
};
