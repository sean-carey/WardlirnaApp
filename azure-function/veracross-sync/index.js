const { getAccessToken } = require("../shared/veracrossAuth");
const { fetchStudents } = require("../shared/veracrossApi");
const { mapStudents } = require("../shared/studentMapper");

module.exports = async function (context, req) {
  const allowedOrigin =
    process.env.ALLOWED_ORIGIN ||
    "https://white-rock-052b54c00.2.azurestaticapps.net";

  const origin = req.headers.origin || allowedOrigin;

  if (!req.headers["x-ms-client-principal"]) {
    context.log("veracross-sync: no x-ms-client-principal header — direct call or non-SWA origin");
  }

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
      }
    };
    return;
  }

  try {
    context.log("veracross-sync: function started");
    context.log("veracross-sync: requesting Veracross access token");

    const accessToken = await getAccessToken();

    context.log("veracross-sync: fetching students");
    const students = await fetchStudents(accessToken);

    context.log(`veracross-sync: fetched ${students.length} students, mapping`);
    const mappedStudents = mapStudents(students);

    context.log(`veracross-sync: returning ${mappedStudents.length} mapped students`);

    context.res = {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Content-Type": "application/json"
      },
      body: mappedStudents
    };
  } catch (error) {
    context.log.error("veracross-sync: error", error && error.stack ? error.stack : error);

    context.res = {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Content-Type": "application/json"
      },
      body: {
        error: "Failed to sync Veracross students",
        message: error.message
      }
    };
  }
};
