import { fs } from 'zx';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertToSVG } from '../services/pumlToSvgConverter.js';
import { cleanupFiles } from '../helpers/utils.js';
import { fetchAndStoreLogsFromGCP } from '../services/fetchAndStoreLogsFromGCP.js';
import { processSlogs } from '../services/slogProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const handleDateRange = async (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: 'Both start date and end date are required.' });
  }

  let inputFile, outputFile, svgFilePath, svgDirPath;

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    inputFile = path.join(__dirname, '..', `${uploadDir}/${uniqueSuffix}.json`);
    outputFile = `${uploadDir}/processed-${uniqueSuffix}.puml`;

    console.log('Fetching data from GCP...');

    await fetchAndStoreLogsFromGCP({
      startDate,
      endDate,
      inputFile,
    });

    console.log('Processing Slogs....');
    await processSlogs({ inputFile, outputFile });

    const svgFolder = `${uniqueSuffix}`;
    await convertToSVG({ pumlFilePath: outputFile, svgDir: svgFolder });

    svgDirPath = path.join(__dirname, '..', `${uploadDir}/${svgFolder}`);
    svgFilePath = path.join(svgDirPath, 'slog.svg');

    console.log('Sending file....');
    res.status(200).sendFile(svgFilePath);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file.');
  } finally {
    console.log('Initiating cleanup...');
    const filesToClean = [inputFile, outputFile, svgFilePath].filter(Boolean);
    await cleanupFiles(filesToClean, svgDirPath);
  }
};
