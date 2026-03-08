/**
 * studentMapper.js
 * Maps raw Veracross student records to the field names expected by the Wardlirna planner frontend.
 *
 * Frontend expects:
 *   vcId, first, last, year, gender, group, atsi, nccd
 */

const HOMEROOM_MAP = {
  484: "Kudlyu",
  485: "Paitya",
  486: "Kadli",
  487: "Kalta",
  488: "Kuya",
  489: "Kurraka",
  490: "Nakudla",
  491: "Yampu",
  492: "Ngungana",
  493: "Winta",
  494: "Kardi",
  497: "Ngakala",
  498: "Leaving",
  570: "Purli",
  572: "Maku",
  573: "Tirntu"
};

function mapGender(code) {
  switch (code) {
    case 1: return "Male";
    case 2: return "Female";
    case 3: return "Non-binary";
    default: return "";
  }
}

function mapGradeLevel(code) {
  if (code === 25) return "Kindy";
  if (code === 20) return "Reception";
  if (typeof code === "number" && Number.isFinite(code)) return `Year ${code}`;
  return "";
}

function mapHomeroom(code) {
  return HOMEROOM_MAP[code] || "__unassigned__";
}

/**
 * Build lookup maps from value_lists returned by /person_profile_codes with X-API-Value-Lists: include
 * Returns: { codeDescriptions: Map<id, description>, categoryDescriptions: Map<id, description> }
 */
function buildValueListMaps(valueLists) {
  const codeDescriptions = new Map();
  const categoryDescriptions = new Map();

  if (!Array.isArray(valueLists)) return { codeDescriptions, categoryDescriptions };

  for (const vl of valueLists) {
    if (!vl.items || !vl.categories) continue;
    for (const item of vl.items) {
      codeDescriptions.set(String(item.id), item.description || '');
    }
    for (const cat of vl.categories) {
      categoryDescriptions.set(String(cat.id), cat.description || '');
    }
  }

  return { codeDescriptions, categoryDescriptions };
}

/**
 * Build a per-person profile code lookup from profile code records.
 * Returns Map<person_id, Array<{codeId, categoryId}>>
 */
function buildProfileMap(profileRecords) {
  const map = new Map();
  if (!Array.isArray(profileRecords)) return map;
  for (const row of profileRecords) {
    const pid = String(row.person_id);
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push({
      codeId: String(row.profile_code_id),
      categoryId: String(row.profile_code_category_id)
    });
  }
  return map;
}

/**
 * Determine ATSI status from profile codes.
 * Returns 'Y' if any profile code category description contains 'indigenous' or 'atsi'
 * and the code description indicates Aboriginal/TSI status.
 */
function getAtsi(personCodes, codeDescriptions, categoryDescriptions) {
  if (!personCodes) return '';
  for (const { codeId, categoryId } of personCodes) {
    const catDesc = (categoryDescriptions.get(String(categoryId)) || categoryDescriptions.get(categoryId) || '').toLowerCase();
    const codeDesc = (codeDescriptions.get(String(codeId)) || codeDescriptions.get(codeId) || '').toLowerCase();
    if (catDesc.includes('indigenous') || catDesc.includes('atsi') || catDesc.includes('aboriginal')) {
      // Y if code indicates Aboriginal, Torres Strait Islander, or Both
      if (codeDesc.includes('aboriginal') || codeDesc.includes('torres') || codeDesc.includes('both') || codeDesc === 'y' || codeDesc === 'yes') {
        return 'Y';
      }
      // Explicit non-indigenous
      if (codeDesc.includes('non') || codeDesc === 'n' || codeDesc === 'no' || codeDesc.includes('neither')) {
        return 'N';
      }
    }
  }
  return '';
}

/**
 * Determine NCCD level from profile codes.
 * Returns level string: 'qual', 'supp', 'subs', 'ext' or ''
 */
function getNccd(personCodes, codeDescriptions, categoryDescriptions) {
  if (!personCodes) return '';
  for (const { codeId, categoryId } of personCodes) {
    const catDesc = (categoryDescriptions.get(String(categoryId)) || categoryDescriptions.get(categoryId) || '').toLowerCase();
    const codeDesc = (codeDescriptions.get(String(codeId)) || codeDescriptions.get(codeId) || '').toLowerCase();
    if (catDesc.includes('nccd') || catDesc.includes('disability') || catDesc.includes('adjustment')) {
      if (codeDesc.includes('quality') || codeDesc.includes('qual')) return 'qual';
      if (codeDesc.includes('supplementary') || codeDesc.includes('supp')) return 'supp';
      if (codeDesc.includes('substantial') || codeDesc.includes('subs')) return 'subs';
      if (codeDesc.includes('extensive') || codeDesc.includes('ext')) return 'ext';
    }
  }
  return '';
}

function mapStudent(row, profileMap, codeDescriptions, categoryDescriptions) {
  if (!row || typeof row !== "object") return null;

  const first = row.preferred_name || row.first_name || "";
  const last  = row.last_name || "";
  const personId = String(row.id);
  const personCodes = profileMap ? profileMap.get(personId) : null;

  return {
    vcId:   row.id ?? null,
    first,
    last,
    year:   mapGradeLevel(row.grade_level),
    gender: mapGender(row.gender),
    group:  mapHomeroom(row.homeroom),
    atsi:   getAtsi(personCodes, codeDescriptions, categoryDescriptions),
    nccd:   getNccd(personCodes, codeDescriptions, categoryDescriptions),
    enrollmentStatus: row.enrollment_status ?? null,
    entryDate:        row.entry_date ?? null,
    exitDate:         row.exit_date ?? null,
  };
}

function mapStudents(rows, profileRecords, valueLists) {
  if (!Array.isArray(rows)) return [];
  
  const profileMap = buildProfileMap(profileRecords);
  const { codeDescriptions, categoryDescriptions } = buildValueListMaps(valueLists);

  return rows.map(row => mapStudent(row, profileMap, codeDescriptions, categoryDescriptions)).filter(Boolean);
}

module.exports = { mapStudents, mapStudent, HOMEROOM_MAP, mapGender, mapGradeLevel, mapHomeroom };
