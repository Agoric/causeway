// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';
import { processAndConvert } from '../services/fileProcessor.js';
import { fetchAndStoreHeightLogs } from '../services/fetchAndStoreHeightLogs.js';
import { networks } from '../helpers/constants.js';
import { fetchAndStoreLogsFromGCP } from '../services/fetchAndStoreLogsFromGCP.js';
import { getTimeStamps } from '../helpers/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = 'uploads';

const strategies = ['blockHeight', 'txHash', 'searchTerm'];
const isValidStrategy = (strategy) => {
  return strategies.includes(strategy);
};

export const handleSearchLogs = async (req, res) => {
  const { search, network, strategy } = req.body;
  console.log(req.body);

  if (!isValidStrategy(strategy)) {
    return res.status(400).json({
      message: 'Invalid strategy selected',
    });
  }

  if (!search) {
    return res.status(400).json({ message: 'Search input is required.' });
  }
  if (!network || !networks[network]) {
    return res.status(400).json({ message: 'Bad Request: Network not found' });
  }

  console.log(`SearchInput:${search} AND AGORIC_NET:${network}`);

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const inputFile = path.join(
    __dirname,
    '..',
    `${uploadDir}/${uniqueSuffix}.json`
  );

  console.log(`Network: ${network}`);
  console.log(`Container Name: ${networks[network].container_name}`);
  console.log(`Cluster Name: ${networks[network].cluster_name}`);
  console.log(`Namespace Name: ${networks[network].namespace_name}`);
  console.log(`Pod Name: ${networks[network].pod_name}`);

  if (strategy === strategies[0]) {
    await fetchAndStoreHeightLogs({
      blockHeight: search,
      inputFile,
      network,
    });
  } else if (strategy === strategies[1]) {
    const { startTime, endTime } = getTimeStamps();
    const queryfilter = `
    jsonPayload.txHash="${search}" AND`;

    await fetchAndStoreLogsFromGCP({
      startTime,
      endTime,
      inputFile,
      network,
      queryfilter,
    });
  } else if (strategy === strategies[2]) {
    const { startTime, endTime } = getTimeStamps();
    const queryfilter = `
    jsonPayload.txHash="${search}" AND`;

    await fetchAndStoreLogsFromGCP({
      startTime,
      endTime,
      inputFile,
      network,
      queryfilter,
    });
  }

  await processAndConvert({ inputFile, res });
};
