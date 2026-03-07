/**
 * shared/studentMapper.js
 *
 * Joins Veracross Query 2 (students) with Query 1 (profile codes).
 * Produces clean student objects matching the planner app's internal format.
 */

const ALL_GROUPS = [
  'Purli','Tirntu','Maku',
  'Kudlyu','Paitya','Kadli',
  'Kuya','Kurraka','Kalta',
  'Kardi','Nakudla','Yampu','Ngungana','Winta',
  'Ngakala'
];

const UNASSIGNED_GROUP = '__unassigned__';

const YEAR_LEVEL_MAP = {
  'kindergarten': 'Kindergarten',
  'kindy':        'Kindergarten',
  'reception':    'Reception',
  'year 1':       'Year 1',
  'year 2':       'Year 2',
  'year 3':       'Year 3',
  'year 4':       'Year 4',
  'year 5':       'Year 5',
  'year 6':       'Year 6',
  'year 7':       'Year 7',
  'year 8':       'Year 8',
  'year 9':       'Year 9',
  'year 10':      'Year 10',
  'year 11':      'Year 11',
  'year 12':      'Year 12',
};

const NCCD_LEVEL_MAP = {
  'extensive':     'ext',
  'substantial':   'subs',
  'supplementary': 'supp',
  'qdtp':          'qdtp',
};

function parseGroup(homeroom) {
  if (!homeroom || homeroom.trim() === '') return UNASSIGNED_GROUP;

  const match = homeroom.trim().match(/^(.+?)\s+Wardli/i);
  if (!match) return UNASSIGNED_GROUP;

  const name = match[1].trim();
  return ALL_GROUPS.includes(name) ? name : UNASSIGNED_GROUP;
}

function parseYear(gradeLevel) {
  if (gradeLevel === null || gradeLevel === undefined) return '';

  const raw = String(gradeLevel).trim();
  if (!raw) return '';

  return YEAR_LEVEL_MAP[raw.toLowerCase()] || raw;
}

function parseGender(gender) {
  if (!gender) return 'Unknown';

  const g = String(gender).trim().toLowerCase();

  if (g === 'male' || g === 'm') return 'Male';
  if (g === 'female' || g === 'f') return 'Female';

  return 'Other';
}

function buildProfileLookup(profileCodes) {
  const lookup = {};

  for (const row of profileCodes) {
    const personId  = String(row.person_id  || row.personId  || '');
    const codeValue = String(row.profile_code_id || row.profileCodeId || row.code || '');
    const category  = String(row.profile_code_category_id || row.profileCodeCategoryId || row.category || '');

    if (!personId) continue;

    if (!lookup[personId]) {
      lookup[personId] = { atsi: 'N', nccd: 'nil' };
    }

    if (category === 'Indigenous Status') {
      const val = codeValue.toLowerCase();

      if (val.includes('aboriginal') || val.includes('torres strait')) {
        lookup[personId].atsi = 'Y';
      }
    }

    if (category === 'Disability Category (Adjustment Level)') {
      const levelMatch = codeValue.match(/\(([^)]+)\)/);

      if (levelMatch) {
        const level = NCCD_LEVEL_MAP[levelMatch[1].toLowerCase()];

        if (level) {
          const levelOrder = ['nil','qdtp','supp','subs','ext'];
          const current = lookup[personId].nccd;

          if (levelOrder.indexOf(level) > levelOrder.indexOf(current)) {
            lookup[personId].nccd = level;
          }
        }
      }
    }
  }

  return lookup;
}

function mapStudents(rawStudents, profileCodes) {
  const profileLookup = buildProfileLookup(profileCodes);

  return rawStudents
    .filter(s => {
      const status = String(s.enrollment_status || s.enrollmentStatus || '').trim();

      const excluded = ['WD:', 'GR:', 'TR:', 'DE:'];

      return !excluded.some(prefix => status.startsWith(prefix));
    })
    .map(s => {
      const vcId      = String(s.id || s.person_id || '');

      const firstName =
        (String(s.preferred_name || s.preferredName || '').trim()) ||
        (String(s.first_name || s.firstName || '').trim());

      const lastName  = String(s.last_name || s.lastName || '').trim();

      const year      = parseYear(s.grade_level || s.gradeLevel || '');

      const gender    = parseGender(s.gender || '');

      const homeroom  = String(s.homeroom || '').trim();

      const group     = parseGroup(homeroom);

      const exitDate  = String(s.exit_date || s.exitDate || '').trim();

      const status    = String(s.enrollment_status || s.enrollmentStatus || '').trim();

      const profile   = profileLookup[vcId] || { atsi: 'N', nccd: 'nil' };

      return {
        vcId,
        first:    firstName,
        last:     lastName,
        year,
        gender,
        atsi:     profile.atsi,
        nccd:     profile.nccd,
        group,
        leaving:  exitDate ? 'Y' : 'N',
        future:   status.startsWith('NE:') ? 'Y' : 'N',
        email:    String(s.email_1 || s.email || '').trim(),
        birthday: String(s.birthday || '').trim(),
        homeroom,
        wantsWith: [],
        notWith:   [],
        family:    '',
      };
    })
    .filter(s => s.first || s.last);
}

module.exports = { mapStudents };
