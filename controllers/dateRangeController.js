import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndStoreLogsFromGCP } from '../services/fetchAndStoreLogsFromGCP.js';
import { processAndConvert } from '../services/fileProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const handleDateRange = async (req, res) => {
  const { startDate } = req.body;
  if (!startDate) {
    return res.status(400).json({ message: 'Start date is required.' });
  }

  const inputFile = path.join(
    __dirname,
    '..',
    `${uploadDir}/${uniqueSuffix}.json`
  );
  console.log('Fetching data from GCP...');

  console.log(`startDate:${startDate}`);
  const formattedStartDate = formatDateString(startDate);

  let endDate = new Date(startDate);
  endDate.setSeconds(endDate.getSeconds() + 20); // Add 20 seconds
  const formattedEndDate = formatDateString(endDate);

  console.log(
    `FormattedStartDate:${formattedStartDate} FormattedEndDate:${formattedEndDate}`
  );

  const queryfilter = `
    timestamp >= "${formattedStartDate}" AND 
    timestamp <= "${formattedEndDate}" AND 
  `;

  await fetchAndStoreLogsFromGCP({ inputFile, queryfilter });
  await processAndConvert({ inputFile, res });
};
