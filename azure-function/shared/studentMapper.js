/**
 * shared/studentMapper.js
 *
 * Joins Veracross Query 2 (students) with Query 1 (profile codes).
 * Produces clean student objects matching the planner app's internal format.
 *
 * Planner student object shape:
 * {
 *   vcId:      string   — Veracross person_id (used as stable identity key)
 *   first:     string   — preferred name, fallback to first_name
 *   last:      string   — last_name
 *   year:      string   — "Kindergarten" | "Reception" | "Year 1" … "Year 12"
 *   gender:    string   — "Male" | "Female" | "Other"
 *   atsi:      "Y"|"N"  — derived from Indigenous Status profile code
 *   nccd:      string   — "nil"|"qdtp"|"supp"|"subs"|"ext"
 *   group:     string   — homeroom group name (e.g. "Purli") or "__unassigned__"
 *   leaving:   "Y"|"N"  — Y if exit_date is populated
 *   future:    "Y"|"N"  — Y if enrollment_status starts with "NE:" (new/future enrolment)
 *   email:     string
 *   birthday:  string
 *   homeroom:  string   — raw homeroom string from Veracross, for reference
 * }
 */

// ── Constants (must match planner app exactly) ────────────────────────────────

const ALL_GROUPS = [
  'Purli','Tirntu','Maku',           // Madlurta
  'Kudlyu','Paitya','Kadli',          // Kurlana
  'Kuya','Kurraka','Kalta',           // Warti
  'Kardi','Nakudla','Yampu','Ngungana','Winta', // Karra
  'Ngakala'                           // Wirra
];

const UNASSIGNED_GROUP = '__unassigned__';

// Veracross grade_level → planner year level
// Handles both "Kindergarten" and legacy "Kindy" spellings
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

// NCCD adjustment level extraction
// profile_code_id examples: "Cognitive (Extensive)", "Social-Emotional (Supplementary)"
const NCCD_LEVEL_MAP = {
  'extensive':     'ext',
  'substantial':   'subs',
  'supplementary': 'supp',
  'qdtp':          'qdtp',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGroup(homeroom) {
  if (!homeroom || homeroom.trim() === '') return UNASSIGNED_GROUP;
  // Format: "Purli Wardli: Johnson" → "Purli"
  const match = homeroom.trim().match(/^(.+?)\s+Wardli/i);
  if (!match) return UNASSIGNED_GROUP;
  const name = match[1].trim();
  return ALL_GROUPS.includes(name) ? name : UNASSIGNED_GROUP;
}

function parseYear(gradeLevel) {
  if (!gradeLevel) return '';
  return YEAR_LEVEL_MAP[gradeLevel.trim().toLowerCase()] || gradeLevel.trim();
}

function parseGender(gender) {
  if (!gender) return 'Unknown';
  const g = gender.trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'Male';
  if (g === 'female' || g === 'f') return 'Female';
  return 'Other';
}

/**
 * Build a lookup map: person_id → { atsi, nccd }
 * from the profile codes query.
 */
function buildProfileLookup(profileCodes) {
  const lookup = {};

  for (const row of profileCodes) {
    // Veracross may return camelCase or snake_case field names
    const personId  = String(row.person_id  || row.personId  || '');
    const codeValue = String(row.profile_code_id || row.profileCodeId || row.code || '');
    const category  = String(row.profile_code_category_id || row.profileCodeCategoryId || row.category || '');

    if (!personId) continue;
    if (!lookup[personId]) lookup[personId] = { atsi: 'N', nccd: 'nil' };

    // ── Indigenous Status ──────────────────────────────────────────────────
    if (category === 'Indigenous Status') {
      const val = codeValue.toLowerCase();
      if (val.includes('aboriginal') || val.includes('torres strait')) {
        lookup[personId].atsi = 'Y';
      }
      // "Neither Aboriginal nor Torres Strait Islander" → stays 'N'
    }

    // ── NCCD Adjustment Level ─────────────────────────────────────────────
    if (category === 'Disability Category (Adjustment Level)') {
      // Extract level from "(Extensive)", "(Substantial)" etc.
      const levelMatch = codeValue.match(/\(([^)]+)\)/);
      if (levelMatch) {
        const level = NCCD_LEVEL_MAP[levelMatch[1].toLowerCase()];
        if (level) {
          // Take highest level if student has multiple rows
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

// ── Main mapper ───────────────────────────────────────────────────────────────

function mapStudents(rawStudents, profileCodes) {
  const profileLookup = buildProfileLookup(profileCodes);

  return rawStudents
    .filter(s => {
      // Only include currently enrolled students
      const status = String(s.enrollment_status || s.enrollmentStatus || '').trim();
      // Exclude withdrawn, graduated, transferred etc.
      // Keep: RE: Re-Enrolled, NE: New Enrolment, and any other active codes
      const excluded = ['WD:', 'GR:', 'TR:', 'DE:'];
      return !excluded.some(prefix => status.startsWith(prefix));
    })
    .map(s => {
      const vcId      = String(s.id || s.person_id || '');
      const firstName = ((s.preferred_name || s.preferredName || '').trim())
                        || ((s.first_name || s.firstName || '').trim());
      const lastName  = (s.last_name || s.lastName || '').trim();
      const year      = parseYear(s.grade_level || s.gradeLevel || '');
      const gender    = parseGender(s.gender || '');
      const homeroom  = (s.homeroom || '').trim();
      const group     = parseGroup(homeroom);
      const exitDate  = (s.exit_date || s.exitDate || '').trim();
      const status    = (s.enrollment_status || s.enrollmentStatus || '').trim();

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
        email:    (s.email_1 || s.email || '').trim(),
        birthday: (s.birthday || '').trim(),
        homeroom,
        // Preserve sociogram and notes from existing app data (never overwritten by sync)
        wantsWith: [],
        notWith:   [],
        family:    '',
      };
    })
    .filter(s => s.first || s.last); // drop completely empty rows
}

module.exports = { mapStudents };
