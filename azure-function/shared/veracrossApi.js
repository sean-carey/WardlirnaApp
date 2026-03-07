/**
 * shared/veracrossApi.js
 *
 * Fetches data from the Veracross API for the planner.
 *
 * Current approach:
 * - No API-side pagination params, because this tenant rejected page/per_page
 * - No API-side enrollment_status[] filter, because this tenant rejected it
 * - Fetch all student rows once, then filter client-side
 * - Profile codes temporarily disabled until the correct endpoint is confirmed
 */

const https = require('https');

const BASE_URL = `https://api.veracross.au/${process.env.VERACROSS_SCHOOL_ROUTE}/v3`;

/**
 * Simple GET helper.
 * Veracross response is expected to be either:
 * - an array
 * - or an object with a "data" array
 */
function fetchEndpoint(token, endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const queryParams = new URLSearchParams(params);
    const qs = queryParams.toString();
    const url = qs ? `${BASE_URL}/${endpoint}?${qs}` : `${BASE_URL}/${endpoint}`;

    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-API-Version': '2022-06-01'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('Veracross API: 401 Unauthorised — check credentials and scopes'));
          return;
        }

        if (res.statusCode === 403) {
          reject(new Error('Veracross API: 403 Forbidden — check OAuth app permissions'));
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Veracross API: HTTP ${res.statusCode} — ${data.slice(0, 500)}`));
          return;
        }

        try {
          const json = JSON.parse(data);
          const records = Array.isArray(json) ? json : (json.data || []);
          resolve(records);
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${data.slice(0, 500)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch students.
 * Because this Veracross API rejected enrollment_status[] parameters,
 * fetch everything and filter client-side.
 */
async function fetchStudents(token) {
  const records = await fetchEndpoint(token, 'students');

  return records.filter(r => {
    const status = String(r.enrollment_status || '').toLowerCase();

    // Keep active / future enrolments.
    // Adjust this if your actual status labels differ.
    return status.startsWith('re:') || status.startsWith('ne:');
  });
}

/**
 * Fetch student profile codes.
 *
 * Temporarily disabled because the assumed endpoint paths tested so far
 * do not exist for this Veracross API/tenant.
 *
 * Returning an empty array allows the planner to keep working:
 * - ATSI should fall back to default mapping values
 * - NCCD should fall back to default mapping values
 *
 * Re-enable once the correct Veracross endpoint is confirmed.
 */
async function fetchProfileCodes(token) {
  return [];
}

module.exports = { fetchStudents, fetchProfileCodes };
