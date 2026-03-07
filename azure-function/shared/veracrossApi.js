'use strict';

const { getAccessToken: getVeracrossAccessToken } = require('./veracrossAuth');

const VERACROSS_BASE_URL =
  process.env.VERACROSS_API_BASE_URL ||
  'https://api.veracross.com';

const VERACROSS_SCHOOL_ROUTE =
  process.env.VERACROSS_SCHOOL_ROUTE ||
  '';

const VERACROSS_API_VERSION =
  process.env.VERACROSS_API_VERSION ||
  'v3';

const VERACROSS_API_REVISION =
  process.env.VERACROSS_API_REVISION ||
  '';

const VERACROSS_PAGE_SIZE = Number(process.env.VERACROSS_PAGE_SIZE || 1000);

const DEBUG_STUDENTS =
  String(process.env.VERACROSS_DEBUG_STUDENTS || '').toLowerCase() === '1' ||
  String(process.env.VERACROSS_DEBUG_STUDENTS || '').toLowerCase() === 'true';

function buildUrl(endpointPath, query = {}) {
  const base = VERACROSS_BASE_URL.replace(/\/+$/, '');
  const schoolRoute = String(VERACROSS_SCHOOL_ROUTE).replace(/^\/+|\/+$/g, '');
  const apiVersion = String(VERACROSS_API_VERSION).replace(/^\/+|\/+$/g, '');
  const path = String(endpointPath || '').replace(/^\/+/, '');

  if (!schoolRoute) {
    throw new Error('Missing VERACROSS_SCHOOL_ROUTE environment variable');
  }

  const url = new URL(`${base}/${schoolRoute}/${apiVersion}/${path}`);

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

async function fetchEndpoint(endpointPath, query = {}, options = {}) {
  const accessToken = await getVeracrossAccessToken();
  const url = buildUrl(endpointPath, query);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json'
  };

  if (VERACROSS_API_REVISION) {
    headers['X-API-Revision'] = VERACROSS_API_REVISION;
  }

  if (options.pageNumber) {
    headers['X-Page-Number'] = String(options.pageNumber);
  }

  if (options.pageSize) {
    headers['X-Page-Size'] = String(options.pageSize);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers
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
    throw new Error(
      `Veracross API returned non-JSON response for ${url}: ${rawText}`
    );
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
    id: student.id ?? student.person_id ?? null,
    first_name: student.first_name ?? student.firstName ?? null,
    last_name: student.last_name ?? student.lastName ?? null,
    grade_level: student.grade_level ?? student.gradeLevel ?? null,
    enrollment_status: student.enrollment_status ?? student.enrollmentStatus ?? null,
    keys: Object.keys(student).slice(0, 30)
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

async function fetchAllPages(endpointPath, query = {}) {
  const allRows = [];
  let pageNumber = 1;

  while (true) {
    const rows = await fetchEndpoint(endpointPath, query, {
      pageNumber,
      pageSize: VERACROSS_PAGE_SIZE
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    if (rows.length < VERACROSS_PAGE_SIZE) {
      break;
    }

    pageNumber += 1;
  }

  return allRows;
}

async function fetchStudents() {
  const students = await fetchAllPages('students');

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
  fetchProfileCodes,
  fetchAllPages
};
