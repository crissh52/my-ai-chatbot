"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../netlify/functions/health.js"),
  "utf8"
);

// Health must work without provider credentials, process.env or network APIs.
// This VM is a test fixture for our inspected source, not an untrusted-code sandbox.
const context = vm.createContext({ exports: {} });
new vm.Script(source, { filename: "netlify/functions/health.js" }).runInContext(
  context,
  { timeout: 1000 }
);
const handler = context.exports.handler;

function checkHeaders(response) {
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
}

test("GET returns the public liveness contract without AI or credentials", async () => {
  const before = Date.now();
  const response = await handler({ httpMethod: "GET" });
  const after = Date.now();

  assert.equal(response.statusCode, 200);
  checkHeaders(response);
  const body = JSON.parse(response.body);
  assert.deepEqual(Object.keys(body).sort(), ["checkedAt", "service", "status"]);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "supervisor-core");

  const timestamp = Date.parse(body.checkedAt);
  assert.ok(Number.isFinite(timestamp) && timestamp >= before && timestamp <= after);
  assert.equal(new Date(timestamp).toISOString(), body.checkedAt);
});

for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
  test(`${method} returns 405 and advertises GET`, async () => {
    const response = await handler({ httpMethod: method });
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, "GET");
    checkHeaders(response);
    assert.deepEqual(JSON.parse(response.body), { error: "method_not_allowed" });
  });
}
