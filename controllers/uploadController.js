import fs from 'fs';
import multer from 'multer';
import { processSlogs } from '../services/slogProcessor.js';
import { convertToSVG } from '../services/pumlToSvgConverter.js';

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
    await processSlogs(inputFile, outputFile);

    const svgFile = outputFile.replace('.puml', '.svg');
    console.log("LOGs...........", svgFile)
    await convertToSVG(outputFile, svgFile);

    res.send(
      `File uploaded and processed successfully. Output saved as ${outputFile}`
    );
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file.');
  }
};

export { upload };
