import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { processSlogs } from '../services/slogProcessor.js';
import { convertToSVG } from '../services/pumlToSvgConverter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir); // Specify the folder to save files
  },
  filename: (_, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

export const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const inputFile = req.file.path;
  const outputFile = `${uploadDir}/processed-${req.file.filename}.puml`;

  try {
    console.log('Processing Slogs....');
    await processSlogs({ inputFile, outputFile });

    console.log('Converting to SVG....');
    await convertToSVG({ inputPath: outputFile });

    console.log('Sending file....');
    res.sendFile(path.join(__dirname, '../uploads/slog.svg'));
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file.');
  }
};

export { upload };
