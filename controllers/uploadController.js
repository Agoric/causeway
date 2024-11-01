import { fs } from 'zx';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { processSlogs } from '../services/slogProcessor.js';
import { convertToSVG } from '../services/pumlToSvgConverter.js';
import { cleanupFiles } from '../helpers/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
const uploadDir = 'uploads';

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir); // Specify the folder to save files
  },
  filename: (_, file, cb) => {
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

export const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  let inputFile, outputFile, svgFilePath, svgDirPath;

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    inputFile = req.file.path;
    outputFile = `${uploadDir}/processed-${req.file.filename}.puml`;

    console.log('Processing Slogs....');
    await processSlogs({ inputFile, outputFile });

    const svgFolder = `${uniqueSuffix}`;
    await convertToSVG({ pumlFilePath: outputFile, svgDir: svgFolder });

    svgDirPath = path.join(__dirname, '..', `${uploadDir}/${svgFolder}`);
    svgFilePath = path.join(svgDirPath, 'slog.svg');

    console.log('Sending file....');
    res.sendFile(svgFilePath);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file.');
  } finally {
    console.log('Initiating cleanup...');
    const filesToClean = [inputFile, outputFile, svgFilePath].filter(Boolean);
    await cleanupFiles(filesToClean, svgDirPath);
  }
};

export { upload };
