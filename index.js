import './lockdown.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './router.js';
import { requestLogger } from './middleware/requestLogger.js';

const PORT = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(requestLogger);
app.use('/', router);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
