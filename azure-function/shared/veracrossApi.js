'use strict';

const { getAccessToken: getVeracrossAccessToken } = require('./veracrossAuth');

const VERACROSS_BASE_URL =
  process.env.VERACROSS_API_BASE_URL ||
  process.env.VERACROSS_BASE_URL ||
  'https://api.veracross.com';

const DEBUG_STUDENTS =
  String(process.env.VERACROSS_DEBUG_STUDENTS || '').toLowerCase() === '1' ||
  String(process.env.VERACROSS_DEBUG_STUDENTS || '').toLowerCase() === 'true';

function buildUrl(endpointPath, query = {}) {
  const base = VERACROSS_BASE_URL.replace(/\/+$/, '');
  const path = String(endpointPath || '').replace(/^\/+/, '');
  const url = new URL(`${base}/${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item));
        }
      }
    } else {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

async function fetchEndpoint(endpointPath, query = {}) {
  const accessToken = await getVeracrossAccessToken();
  const url = buildUrl(endpointPath, query);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Veracross API request failed: ${response.status} ${response.statusText} for ${url}\n${rawText}`
    );
  }

  if (!rawText) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Veracross API returned non-JSON response for ${url}: ${rawText}`);
  }

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.results)) return parsed.results;
  if (Array.isArray(parsed.students)) return parsed.students;

  return parsed ? [parsed] : [];
}

function logStudentPreview(students) {
  if (!DEBUG_STUDENTS) return;

  const preview = students.slice(0, 3).map((student, index) => ({
    index,
    id:
      student.student_id ??
      student.id ??
      student.person_id ??
      student.personID ??
      null,
    first_name:
      student.first_name ??
      student.firstname ??
      student.firstName ??
      null,
    last_name:
      student.last_name ??
      student.lastname ??
      student.lastName ??
      null,
    grade_level:
      student.grade_level ??
      student.grade ??
      student.current_grade ??
      null,
    enrollment_status:
      student.enrollment_status ??
      student.enrollmentStatus ??
      null,
    keys: Object.keys(student).slice(0, 20)
  }));

  console.log(
    'veracrossApi.fetchStudents debug preview:',
    JSON.stringify(
      {
        totalReturned: students.length,
        preview
      },
      null,
      2
    )
  );
}

async function fetchStudents() {
  const students = await fetchEndpoint('students');

  if (!Array.isArray(students)) {
    console.warn(
      'veracrossApi.fetchStudents: expected array, received:',
      typeof students
    );
    return [];
  }

  logStudentPreview(students);
  return students;
}

async function fetchProfileCodes() {
  return [];
}

module.exports = {
  fetchEndpoint,
  fetchStudents,
  fetchProfileCodes
};
