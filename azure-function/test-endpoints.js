const auth = require('./shared/veracrossAuth');
const api = require('./shared/veracrossApi');

auth.getAccessToken().then(token => {
  return api.fetchProfileCodes(token);
}).then(result => {
  console.log('records:', result.records.length);
  console.log('sample record:', JSON.stringify(result.records[0]));
  console.log('valueLists:', JSON.stringify(result.valueLists).substring(0, 800));
}).catch(e => {
  console.error('ERROR:', e.message);
});
