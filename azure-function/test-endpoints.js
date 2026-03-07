const auth = require('./shared/veracrossAuth');
auth.getAccessToken().then(t => {
  const https = require('https');
  const paths = [
    '/v3/students',
    '/v3/profile-codes',
    '/v3/student-profiles',
    '/v3/enrollment-codes',
    '/v3/code-categories',
    '/v3/codes',
    '/v3/profile-code-categories',
    '/v3/student-profile-code-categories'
  ];
  paths.forEach(p => {
    const req = https.get('https://api.veracross.au/ngutu_college' + p, {
      headers: { Authorization: 'Bearer ' + t, 'X-Page-Size': '1', 'X-Page-Number': '1' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => console.log(p, '->', res.statusCode));
    });
    req.end();
  });
}).catch(e => console.error(e.message));
