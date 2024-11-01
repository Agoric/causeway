import express from 'express';
import { serveHomePage } from './controllers/homeController.js';
import { handleFileUpload, upload } from './controllers/uploadController.js';
import { handleTimeRange } from './controllers/timeRangeController.js';

const router = express.Router();

router.get('/', serveHomePage);
router.post('/upload', upload.single('file'), handleFileUpload);
router.post('/submit-time-range', handleTimeRange);

export default router;
