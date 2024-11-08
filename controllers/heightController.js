import path from 'path';
import { fileURLToPath } from 'url';
import { processAndConvert } from '../services/fileProcessor.js';
import { fetchGCPLogsForHeight } from '../services/fetchGCPLogsForHeight.js';
import { networks } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const handleHeightLogs = async (req, res) => {
  const { height, network } = req.body;
  if (!height) {
    return res.status(400).json({ message: 'Height is required.' });
  }
  if (!network || !networks[network]) {
    return res.status(400).json({ error: 'Bad Request: Network not found' });
  }

  console.log(`height:${height} AND AGORIC_NET:${network}`);

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
    network,
  });
  await processAndConvert({ inputFile, res });
};
