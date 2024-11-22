import express from 'express';
import { serveHomePage } from './controllers/homeController.js';
import { handleFileUpload, upload } from './controllers/uploadController.js';
import { handleDateRange } from './controllers/dateRangeController.js';
import { handleSearchLogs } from './controllers/searchLogsController.js';

const router = express.Router();

router.get('/', serveHomePage);
router.post('/upload', upload.single('file'), handleFileUpload);
router.post('/submit-date-range', handleDateRange);
router.post('/search-logs', handleSearchLogs);

export default router;
