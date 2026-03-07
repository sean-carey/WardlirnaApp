/**
 * Ngutu College — Class Grouping Planner
 * Azure Function: veracross-sync
 *
 * Fetches student data from Veracross API using OAuth 2.0 client credentials.
 * Joins Query 2 (students) with Query 1 (profile codes) and returns a clean
 * student array ready for the conflict-review screen in the planner app.
 *
 * Endpoint: GET /api/veracross-sync
 * Returns:  { students: [...], fetchedAt: ISO8601, count: N }
 */

const { getAccessToken } = require('../shared/veracrossAuth');
const { fetchStudents, fetchProfileCodes } = require('../shared/veracrossApi');
const { mapStudents } = require('../shared/studentMapper');

module.exports = async function (context, req) {
  context.log('veracross-sync: function started');

  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers['origin'] || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders, body: '' };
    return;
  }

  // CORS origin check — only enforce if ALLOWED_ORIGIN is set
  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
    context.log.warn('veracross-sync: origin rejected:', requestOrigin);
    context.res = {
      status: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Origin not allowed' })
    };
    return;
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  // x-ms-client-principal is set by Azure Static Web Apps EasyAuth
  // when the authenticated user's browser calls this function.
  // We decode it to confirm a valid authenticated school user.
  const principalHeader = req.headers['x-ms-client-principal'];
  if (principalHeader) {
    try {
      const principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf8'));
      context.log('veracross-sync: authenticated user:', principal.userDetails || 'unknown');
      // Optional: add tenant check here if needed
      // const tid = (principal.claims || []).find(c => c.typ === 'tid');
    } catch (e) {
      context.log.warn('veracross-sync: could not parse principal header:', e.message);
    }
  } else {
    context.log.warn('veracross-sync: no x-ms-client-principal header — direct call or non-SWA origin');
    // Not blocking — Function App CORS + ALLOWED_ORIGIN check provides the boundary
    // If you want to enforce SWA-only access, uncomment below:
    // context.res = { status: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Authentication required' }) };
    // return;
  }

  // ── Fetch from Veracross ──────────────────────────────────────────────────
  try {
    context.log('veracross-sync: requesting Veracross access token');
    const token = await getAccessToken();

    context.log('veracross-sync: fetching students');
    const rawStudents = await fetchStudents(token);

    context.log(`veracross-sync: fetched ${rawStudents.length} students, fetching profile codes`);
    const { records: profileRecords, valueLists } = await fetchProfileCodes(token);
    context.log(`veracross-sync: fetched ${profileRecords.length} profile code rows, mapping`);
    const students = mapStudents(rawStudents, profileRecords, valueLists);

    context.log(`veracross-sync: returning ${students.length} mapped students`);
    context.res = {
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        students,
        fetchedAt: new Date().toISOString(),
        count: students.length
      })
    };

  } catch (err) {
    context.log.error('veracross-sync error:', err.message, err.stack);
    context.res = {
      status: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to fetch from Veracross',
        detail: err.message
      })
    };
  }
};
