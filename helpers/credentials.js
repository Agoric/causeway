// @ts-check
import { getAccessToken } from './utils.js';
import { readFileSync } from 'fs';

export let accessToken;
export let serviceAccount;

export const setupCredentials = async () => {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
      );
    }
    serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    accessToken = await getAccessToken(serviceAccount);
  } catch (error) {
    console.error('Failed to load service account credentials:', error.message);
    throw error;
  }
};
