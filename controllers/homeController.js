import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serveHomePage = (_, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
};
