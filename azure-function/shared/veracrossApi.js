const fetch = require("node-fetch");

const SCHOOL_ROUTE = process.env.VERACROSS_SCHOOL_ROUTE || "ngutu_college";
const BASE_URL = `https://api.veracross.com/${SCHOOL_ROUTE}/v3`;
const DEFAULT_PAGE_SIZE = 1000;

async function fetchEndpoint(endpoint, accessToken, options = {}) {
  const {
    pageNumber,
    pageSize,
    extraHeaders = {}
  } = options;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...extraHeaders
  };

  if (pageNumber != null) {
    headers["X-Page-Number"] = String(pageNumber);
  }

  if (pageSize != null) {
    headers["X-Page-Size"] = String(pageSize);
  }

  const response = await fetch(`${BASE_URL}/${endpoint}`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Veracross API request failed: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json();
}

async function fetchAllPages(endpoint, accessToken, pageSize = DEFAULT_PAGE_SIZE) {
  const allRows = [];
  let pageNumber = 1;

  while (true) {
    const pageRows = await fetchEndpoint(endpoint, accessToken, {
      pageNumber,
      pageSize
    });

    if (!Array.isArray(pageRows)) {
      throw new Error(
        `Expected array response from Veracross for ${endpoint}, received ${typeof pageRows}`
      );
    }

    allRows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    pageNumber += 1;
  }

  return allRows;
}

async function fetchStudents(accessToken) {
  const students = await fetchAllPages("students", accessToken, DEFAULT_PAGE_SIZE);

  console.log(
    "veracrossApi.fetchStudents debug preview:",
    JSON.stringify(
      {
        totalReturned: students.length,
        preview: students.slice(0, 3).map((s, index) => ({
          index,
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          grade_level: s.grade_level,
          enrollment_status: s.enrollment_status,
          keys: Object.keys(s)
        }))
      },
      null,
      2
    )
  );

  return students;
}

module.exports = {
  fetchEndpoint,
  fetchAllPages,
  fetchStudents
};
