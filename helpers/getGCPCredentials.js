// @ts-check
import { fs } from 'zx';

let credentials = null;

export const getCredentials = () => {
  if (credentials) {
    return credentials;
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
    );
  }

  try {
    const credentialsData = fs.readFileSync(credentialsPath, 'utf8');
    credentials = JSON.parse(credentialsData);
  } catch (error) {
    throw new Error(
      'Failed to read or parse credentials file: ' + error.message
    );
  }

  return credentials;
};
