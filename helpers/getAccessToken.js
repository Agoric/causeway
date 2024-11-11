import crypto from 'crypto';
import querystring from 'querystring';
import { getCredentials } from './getGCPCredentials.js';

const credentials = getCredentials();

const createJWT = (scopes) => {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: credentials.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const header = JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
  });

  const base64Header = Buffer.from(header).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );

  const unsignedJwt = `${base64Header}.${base64Payload}`;
  const signer = crypto.createSign('RSA-SHA256');

  signer.update(unsignedJwt);
  const signature = signer.sign(credentials.private_key, 'base64');

  const base64UrlSignature = signature
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsignedJwt}.${base64UrlSignature}`;
};

export const getAccessToken = async (scopes) => {
  try {
    const signedJwt = createJWT(scopes);

    const data = querystring.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });

    const responseBody = await response.json();

    if (response.ok && responseBody.access_token) {
      return responseBody.access_token;
    } else {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};
