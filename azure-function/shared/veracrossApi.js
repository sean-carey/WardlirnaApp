/**
 * shared/veracrossApi.js
 *
 * Fetches data from the Veracross Data API v3.
 *
 * Students endpoint:
 *   GET /v3/students
 *
 * Profile codes endpoint:
 *   GET /v3/person_profile_codes?X-API-Value-Lists=include
 *   Returns profile_code_id and profile_code_category_id per person,
 *   plus value_lists with human-readable descriptions.
 */

const https = require('https');

const BASE_URL = `https://api.veracross.au/${process.env.VERACROSS_SCHOOL_ROUTE}/v3`;

function fetchPage(token, path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...extraHeaders
      }
    };

    const url = `${BASE_URL}${path}`;

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) { reject(new Error('Veracross 401 — check credentials')); return; }
        if (res.statusCode === 403) { reject(new Error('Veracross 403 — check OAuth scopes')); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Veracross HTTP ${res.statusCode} — ${data.slice(0, 200)}`)); return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchAllPages(token, path, extraHeaders = {}) {
  const allRecords = [];
  let pageNum = 1;
  const pageSize = 1000;
  let valueLists = null;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const fullPath = `${path}${separator}`;
    const json = await fetchPage(token, fullPath, {
      'X-Page-Number': String(pageNum),
      'X-Page-Size': String(pageSize),
      ...extraHeaders
    });

    const records = json.data || [];
    
    // Capture value_lists from first page (they're the same on all pages)
    if (pageNum === 1 && json.value_lists) {
      valueLists = json.value_lists;
    }

    allRecords.push(...records);

    if (records.length < pageSize) break;
    pageNum++;
  }

  return { records: allRecords, valueLists };
}

async function fetchStudents(token) {
  const { records } = await fetchAllPages(token, '/students');
  return records;
}

async function fetchProfileCodes(token) {
  // Use X-API-Value-Lists: include to get human-readable descriptions
  const { records, valueLists } = await fetchAllPages(token, '/person_profile_codes', {
    'X-API-Value-Lists': 'include'
  });
  return { records, valueLists };
}

module.exports = { fetchStudents, fetchProfileCodes };
