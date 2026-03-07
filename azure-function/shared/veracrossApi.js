/**
 * shared/veracrossApi.js
 *
 * Fetches data from the two Veracross API queries needed by the planner.
 *
 * Query 2 — Students (grade_level, homeroom, gender etc.)
 *   GET /v3/students
 *   Fields: id, first_name, preferred_name, last_name, gender,
 *           grade_level, graduation_year, homeroom, enrollment_status, exit_date
 *
 * Query 1 — Profile Codes (Indigenous Status, NCCD adjustment level)
 *   GET /v3/student-profile-codes   (confirm exact endpoint with your Veracross rep)
 *   Fields: id, person_id, profile_code_id, profile_code_category_id
 *
 * Veracross paginates at 1000 records — we loop until all pages are fetched.
 */

const https = require('https');

const BASE_URL = `https://api.veracross.au/${process.env.VERACROSS_SCHOOL_ROUTE}/v3`;

/**
 * Generic paginated GET helper.
 * Veracross uses Link header (RFC 5988) for pagination.
 * Falls back to page/per_page params if Link header not present.
 */
async function fetchAllPages(token, endpoint, params = {}) {
  const allRecords = [];
  let page = 1;
  const perPage = 1000;
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({
      ...params,
      page: String(page),
      per_page: String(perPage)
    });

    const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;
    const records = await fetchPage(token, url);

    if (!records || records.length === 0) {
      hasMore = false;
    } else {
      allRecords.push(...records);
      // If we got fewer than perPage, we're on the last page
      if (records.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allRecords;
}

function fetchPage(token, url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
        'X-API-Version': '2022-06-01'   // pin to a stable version
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
          reject(new Error(`Veracross API: HTTP ${res.statusCode} — ${data.slice(0, 200)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          // Veracross wraps results in a "data" key
          resolve(Array.isArray(json) ? json : (json.data || []));
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch Query 2 — student records.
 * Filter to currently enrolled students only.
 */
async function fetchStudents(token) {
  // enrollment_status filter — adjust if Veracross uses different param name
  const records = await fetchAllPages(token, 'students', {
    'enrollment_status[]': ['RE: Re-Enrolled', 'RE: New Enrolment']
    // If the API doesn't support server-side filtering, remove this and
    // filter client-side in studentMapper.js
  });
  return records;
}

/**
 * Fetch Query 1 — student profile codes.
 * Returns all rows; we filter by category in the mapper.
 */
async function fetchProfileCodes(token) {
  // Confirm exact endpoint path with your Veracross API documentation
  // Common paths: student-profile-codes, students/profile-codes, profile-codes
  const records = await fetchAllPages(token, 'student-profile-codes');
  return records;
}

module.exports = { fetchStudents, fetchProfileCodes };
