import express from 'express';
import { serveHomePage } from './controllers/homeController.js';
import { handleFileUpload, upload } from './controllers/uploadController.js';

const router = express.Router();

router.get('/', serveHomePage);
router.post('/upload', upload.single('file'), handleFileUpload);

export default router;
