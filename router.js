import express from 'express';
import { serveHomePage } from './controllers/homeController.js';
import { handleFileUpload, upload } from './controllers/uploadController.js';
import { handleDateRange } from './controllers/dateRangeController.js';
import { handleHeightLogs } from './controllers/heightController.js';

const router = express.Router();

router.get('/', serveHomePage);
router.post('/upload', upload.single('file'), handleFileUpload);
router.post('/submit-date-range', handleDateRange);
router.post('/submit-height', handleHeightLogs);

export default router;
