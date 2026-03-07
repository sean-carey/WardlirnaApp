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
    case 1:
      return "Male";
    case 2:
      return "Female";
    case 3:
      return "Non-binary";
    default:
      return "";
  }
}

function mapGradeLevel(code) {
  if (code === 25) return "Kindy";
  if (code === 20) return "Reception";
  if (typeof code === "number" && Number.isFinite(code)) return `Year ${code}`;
  return "";
}

function mapHomeroom(code) {
  return HOMEROOM_MAP[code] || "";
}

function mapStudent(row) {
  if (!row || typeof row !== "object") return null;

  const firstName = row.first_name || "";
  const lastName = row.last_name || "";
  const preferredName = row.preferred_name || firstName;

  return {
    id: row.id ?? null,

    firstName,
    lastName,
    preferredName,
    fullName: [preferredName, lastName].filter(Boolean).join(" ").trim(),

    genderCode: row.gender ?? null,
    gender: mapGender(row.gender),

    gradeCode: row.grade_level ?? null,
    grade: mapGradeLevel(row.grade_level),

    homeroomCode: row.homeroom ?? null,
    homeroom: mapHomeroom(row.homeroom),

    enrollmentStatusCode: row.enrollment_status ?? null,

    householdId: row.household_id ?? null,
    schoolLevel: row.school_level ?? null,
    graduationYear: row.graduation_year ?? null,
    homeroomTeacher: row.homeroom_teacher ?? null,
    advisor: row.advisor ?? null,
    campus: row.campus ?? null,
    username: row.username ?? null,
    entryDate: row.entry_date ?? null,
    exitDate: row.exit_date ?? null,
    birthday: row.birthday ?? null,
    roles: Array.isArray(row.roles) ? row.roles : [],
    lastModifiedDate: row.last_modified_date ?? null,
    house: row.house ?? null,
    email: row.email_1 ?? null
  };
}

function mapStudents(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapStudent).filter(Boolean);
}

module.exports = {
  HOMEROOM_MAP,
  mapGender,
  mapGradeLevel,
  mapHomeroom,
  mapStudent,
  mapStudents
};
