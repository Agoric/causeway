import path from 'path';
import { processSlogs } from './slogProcessor.js';
import { convertToSVG } from './pumlToSvgConverter.js';
import { cleanupFiles } from '../helpers/utils.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

export const processAndConvert = async ({ inputFile, res }) => {
  let outputFile, svgFilePath, svgDirPath;

  try {
    outputFile = `${uploadDir}/processed-${uniqueSuffix}.puml`;
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
