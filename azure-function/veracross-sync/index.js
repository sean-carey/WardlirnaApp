/**
 * SWA Role Assignment Function
 * Maps Azure AD group membership to SWA roles (admin / viewer)
 * Called automatically by SWA after login
 */

const ADMIN_GROUP_ID  = 'a6734415-683b-4356-8d78-a5af69581f74';
const VIEWER_GROUP_ID = 'f6053661-7aa7-40f8-a987-1d0dbe72aa47';

module.exports = async function (context, req) {
  const body = req.body;

  // Extract group claims from the token
  const claims = (body && body.claims) ? body.claims : [];
  const groups = claims
    .filter(c => c.typ === 'groups')
    .map(c => c.val);

  context.log('roles-function: user claims groups:', groups);

  const roles = [];
  if (groups.includes(ADMIN_GROUP_ID))  roles.push('admin');
  if (groups.includes(VIEWER_GROUP_ID)) roles.push('viewer');

  context.log('roles-function: assigned roles:', roles);

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles })
  };
};
