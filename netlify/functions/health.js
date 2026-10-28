
"use strict";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...HEADERS, Allow: "GET" },
      body: JSON.stringify({ error: "method_not_allowed" }),
    };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      status: "ok",
      service: "supervisor-core",
      checkedAt: new Date().toISOString(),
    }),
  };
};
