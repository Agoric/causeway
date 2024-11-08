import path from 'path';
import { fileURLToPath } from 'url';
import { processAndConvert } from '../services/fileProcessor.js';
import { fetchGCPLogsForHeight } from '../services/fetchGCPLogsForHeight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const handleHeightLogs = async (req, res) => {
  const { height } = req.body;
  if (!height) {
    return res.status(400).json({ message: 'Height is required.' });
  }

  console.log(`Height received: ${height}`);

  const inputFile = path.join(
    __dirname,
    '..',
    `${uploadDir}/${uniqueSuffix}.json`
  );
  console.log('Fetching data from GCP...');

  await fetchGCPLogsForHeight({
    startBlockHeight: height,
    endBlockHeight: height,
    inputFile,
  });
  await processAndConvert({ inputFile, res });
};
