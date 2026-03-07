/**
 * shared/veracrossAuth.js
 *
 * Handles OAuth 2.0 client_credentials grant for Veracross API.
 * Tokens expire after 1 hour — client credentials flow has no refresh token,
 * so we request a new token each invocation (Azure Functions are stateless).
 *
 * Token endpoint: https://accounts.veracross.au/{school_route}/oauth/token
 */

const https = require('https');
const querystring = require('querystring');

async function getAccessToken() {
  const clientId     = process.env.VERACROSS_CLIENT_ID;
  const clientSecret = process.env.VERACROSS_CLIENT_SECRET;
  const schoolRoute  = process.env.VERACROSS_SCHOOL_ROUTE;

  if (!clientId || !clientSecret || !schoolRoute) {
    throw new Error(
      'Missing Veracross credentials. Ensure VERACROSS_CLIENT_ID, ' +
      'VERACROSS_CLIENT_SECRET, and VERACROSS_SCHOOL_ROUTE are set ' +
      'in Application Settings.'
    );
  }

  const body = querystring.stringify({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    // Scopes required for student data — confirm with your Veracross rep
    // if your OAuth app was configured with different scope names
    scope:         'students:list students:read'
  });

  const tokenUrl = `https://accounts.veracross.au/${schoolRoute}/oauth/token`;

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(tokenUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(
              `Token request failed: ${json.error || 'unknown'} — ${json.error_description || data}`
            ));
          }
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { getAccessToken };
