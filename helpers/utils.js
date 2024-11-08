// @ts-check
import { fs } from 'zx';
import { createSign } from 'crypto';

export const checkFileExists = async ({ filePath, description = 'File' }) => {
  try {
    await fs.access(filePath);
    console.log(`${description} found at ${filePath}`);
    return true;
  } catch {
    throw Error(`Error: ${description} not found at path: ${filePath}`);
  }
};

export const cleanupFiles = async (files, directory) => {
  try {
    for (const file of files) {
      if (fs.existsSync(file)) {
        await fs.promises.unlink(file);
        console.log(`Deleted file: ${file}`);
      }
    }

    if (directory && fs.existsSync(directory)) {
      await fs.promises.rm(directory, { recursive: true, force: true });
      console.log(`Deleted directory: ${directory}`);
    }
  } catch (error) {
    console.error('Failed to delete files or directory:', error);
  }
};

export const formatDateString = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString();
};

export const base64urlEncode = (str) =>
  Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const createSignedJWT = (payload, privateKey) => {
  const signingAlgorithm = 'RSA-SHA256';
  const jwtTokenRequestHeader = { alg: 'RS256', typ: 'JWT' };

  const encodedHeader = base64urlEncode(JSON.stringify(jwtTokenRequestHeader));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const sign = createSign(signingAlgorithm);
  sign.update(toSign);
  const signature = sign
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${toSign}.${signature}`;
};

/**
 * @param {{
 *  auth_provider_x509_cert_url: string;
 *  auth_uri: string;
 *  client_email: string;
 *  client_id: string;
 *  client_x509_cert_url: string;
 *  project_id: string;
 *  private_key: string;
 *  private_key_id: string;
 *  token_uri: string;
 *  type: string;
 *  universe_domain: string;
 * }} serviceAccount
 */
export const getAccessToken = async (serviceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const AUDIENCE = 'https://oauth2.googleapis.com/token';
  const SUCCESS_ICON = '✅';
  const TOKEN_SCOPE = 'https://www.googleapis.com/auth/logging.read';
  const IN_PROGRESS_ICON = '⏳';

  const payload = {
    aud: AUDIENCE,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    scope: TOKEN_SCOPE,
  };

  const jwt = createSignedJWT(payload, serviceAccount.private_key);

  const params = new URLSearchParams();
  params.append('assertion', jwt);
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');

  console.log(`Fetching JWT access token ${IN_PROGRESS_ICON}`);

  const response = await fetch(AUDIENCE, {
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorMessage = `Failed to obtain access token due to error: ${await response.text()}`;
    throw Error(errorMessage);
  }
  console.log(`Fetched JWT access token ${SUCCESS_ICON}`);

  const data = await response.json();
  return String(data.access_token);
};
