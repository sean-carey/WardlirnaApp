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
 *
 * Required Application Settings (set in Azure Portal → Function App → Configuration):
 *   VERACROSS_CLIENT_ID      — OAuth client ID
 *   VERACROSS_CLIENT_SECRET  — OAuth client secret (store in Key Vault, ref via @Microsoft.KeyVault)
 *   VERACROSS_SCHOOL_ROUTE   — Your school route slug, e.g. "ngutucollege"
 *   ALLOWED_ORIGIN           — Your Static Web App URL, e.g. "https://grouping-planner.azurestaticapps.net"
 */

const { getAccessToken } = require('../shared/veracrossAuth');
const { fetchStudents, fetchProfileCodes } = require('../shared/veracrossApi');
const { mapStudents } = require('../shared/studentMapper');

module.exports = async function (context, req) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const requestOrigin = req.headers['origin'] || '';

  // Only allow requests from our Static Web App
  if (allowedOrigin && requestOrigin !== allowedOrigin) {
    context.res = {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Origin not allowed' }
    };
    return;
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders, body: '' };
    return;
  }

  // ── Auth check — require the caller to pass the Static Web App's EasyAuth token ──
  // The planner app sends the /.auth/me token; we verify the user is authenticated.
  // If you want role-based access, check claims here.
  const authHeader = req.headers['x-ms-client-principal'];
  if (!authHeader) {
    context.res = {
      status: 401,
      headers: corsHeaders,
      body: { error: 'Authentication required' }
    };
    return;
  }

  try {
    context.log('veracross-sync: requesting access token');
    const token = await getAccessToken();

    context.log('veracross-sync: fetching students');
    const rawStudents = await fetchStudents(token);

    context.log(`veracross-sync: fetched ${rawStudents.length} students, fetching profile codes`);
    const profileCodes = await fetchProfileCodes(token);

    context.log(`veracross-sync: fetched ${profileCodes.length} profile code rows, mapping`);
    const students = mapStudents(rawStudents, profileCodes);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        students,
        fetchedAt: new Date().toISOString(),
        count: students.length
      }
    };

  } catch (err) {
    context.log.error('veracross-sync error:', err.message);
    context.res = {
      status: 502,
      headers: corsHeaders,
      body: {
        error: 'Failed to fetch from Veracross',
        detail: err.message
      }
    };
  }
};
