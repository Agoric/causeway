// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';
import { processAndConvert } from '../services/fileProcessor.js';
import { fetchAndStoreHeightLogs } from '../services/fetchAndStoreHeightLogs.js';
import { networks } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = 'uploads';

const validStrategies = new Set(['blockHeight', 'txHash', 'searchTerm']);
const isValidStrategy = (strategy) => {
  return validStrategies.has(strategy);
};

export const handleHeightLogs = async (req, res) => {
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

  const queryfilter = `
    resource.labels.container_name="${networks[network].container_name}" AND
    resource.labels.cluster_name="${networks[network].cluster_name}" AND
    resource.labels.namespace_name="${networks[network].namespace_name}" AND
    resource.labels.pod_name="${networks[network].pod_name}" AND
    resource.type="k8s_container"
  `;

  await fetchAndStoreHeightLogs({
    blockHeight: search,
    inputFile,
    network,
    queryfilter,
  });
  await processAndConvert({ inputFile, res });
};
