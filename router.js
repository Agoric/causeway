import express from 'express';
import { serveHomePage } from './controllers/homeController.js';

const router = express.Router();

router.get('/', serveHomePage);

export default router;
