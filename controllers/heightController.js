import path from 'path';
import { fileURLToPath } from 'url';
import { processAndConvert } from '../services/fileProcessor.js';
import { fetchGCPLogsForHeight } from '../services/fetchGCPLogsForHeight.js';
import { networks } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  console.log('Fetching data from GCP...');
  await fetchGCPLogsForHeight({
    startBlockHeight: height,
    endBlockHeight: height,
    inputFile,
    network,
    queryfilter,
  });
  await processAndConvert({ inputFile, res });
};
