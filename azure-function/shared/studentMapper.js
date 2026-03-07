/**
 * studentMapper.js
 * Maps raw Veracross student records to the field names expected by the Wardlirna planner frontend.
 *
 * Frontend expects:
 *   vcId, first, last, year, gender, group, atsi, nccd
 */

const HOMEROOM_MAP = {
  484: "Kudlyu Wardli",
  485: "Paitya Wardli",
  486: "Kadli Wardli",
  487: "Kalta Wardli",
  488: "Kuya Wardli",
  489: "Kurraka Wardli",
  490: "Nakudla Wardli",
  491: "Yampu Wardli",
  492: "Ngungana Wardli",
  493: "Winta Wardli",
  494: "Kardi Wardli",
  497: "Ngakala Wardli",
  498: "Leaving",
  570: "Purli Wardli",
  572: "Maku Wardli",
  573: "Tirntu Wardli"
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
  return HOMEROOM_MAP[code] || "Unassigned";
}

function mapStudent(row) {
  if (!row || typeof row !== "object") return null;

  // Use preferred name if available, fall back to first_name
  const first = row.preferred_name || row.first_name || "";
  const last  = row.last_name || "";

  return {
    vcId:   row.id ?? null,           // Veracross person ID — used for matching in frontend
    first,
    last,
    year:   mapGradeLevel(row.grade_level),
    gender: mapGender(row.gender),
    group:  mapHomeroom(row.homeroom), // Maps homeroom ID → Wardli group name
    atsi:   "",                        // Not available from /students — requires profile codes
    nccd:   "",                        // Not available from /students — requires profile codes
    // Extra fields retained for potential future use (not used by frontend)
    enrollmentStatus: row.enrollment_status ?? null,
    entryDate:        row.entry_date ?? null,
    exitDate:         row.exit_date ?? null,
  };
}

function mapStudents(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapStudent).filter(Boolean);
}

module.exports = { mapStudents, mapStudent, HOMEROOM_MAP, mapGender, mapGradeLevel, mapHomeroom };
