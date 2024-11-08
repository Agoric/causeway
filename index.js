import './lockdown.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { fs } from 'zx';
import router from './router.js';
import { requestLogger } from './middleware/requestLogger.js';
import { setupCredentials } from './helpers/credentials.js';

const PORT = 3000;
const UPLOAD_DIR = 'uploads';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

setupCredentials()
  .then(() => {
    console.log('Credentials setup successfully');
  })
  .catch((error) => {
    console.error('Failed to set up credentials:', error);
    process.exit(1);
  });

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  '/scripts/ses',
  express.static(path.join(__dirname, 'node_modules/ses/dist'))
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);
app.use('/', router);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
