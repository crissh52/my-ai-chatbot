"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createGithubReader } = require("../supervisor/github-public.cjs");
const { createSupervisorServer } = require("../supervisor/server.cjs");
const sha = "a".repeat(40);

function upstream() {
  const calls = [];
  let fail = false;
  const bodies = [{ private: false, full_name: "crissh52/my-ai-chatbot" },
    { commit: { sha }, protected: true },
    { title: "<img src=x onerror=alert(1)>", state: "open", draft: true, merged: false,
      head: { sha, ref: "feature/test" }, base: { ref: "main" }, changed_files: 10 },
    { check_runs: [{ name: "Health contract tests", status: "completed", conclusion: "success" }], total_count: 1 }];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (fail) throw new Error("synthetic-private-error-do-not-return");
    return new Response(JSON.stringify(bodies[(calls.length - 1) % 4]), {
      headers: { "x-ratelimit-remaining": "42", "x-ratelimit-reset": "2000000000" },
    });
  };
  return { calls, bodies, fetchImpl, fail: () => { fail = true; } };
}

test("public connector reads only fixed GitHub paths without credentials or writes", async () => {
  const mock = upstream();
  const result = await createGithubReader({ fetchImpl: mock.fetchImpl, now: () => 1000 }).read();
  assert.equal(mock.calls.length, 4);
  for (const call of mock.calls) {
    assert.ok(call.url.startsWith("https://api.github.com/repos/crissh52/my-ai-chatbot"));
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.headers.Authorization, undefined);
    assert.equal(call.options.body, undefined);
    assert.ok(call.options.signal);
  }
  assert.equal(result.status, "observed");
  assert.equal(result.snapshot.main.sha, sha);
  assert.equal(result.snapshot.check.conclusion, "success");
  assert.equal(result.snapshot.netlify.status, "not_checked");
  assert.equal(result.quota.remaining, 42);
});

test("concurrent and repeated refreshes share one four-request observation", async () => {
  const mock = upstream();
  const reader = createGithubReader({ fetchImpl: mock.fetchImpl, now: () => 1000 });
  await Promise.all([reader.read(), reader.read(), reader.read()]);
  const again = await reader.read();
  assert.equal(mock.calls.length, 4);
  assert.equal(again.cached, true);
});

test("expired observation refreshes only after the cooldown", async () => {
  const mock = upstream();
  let clock = 1000;
  const reader = createGithubReader({ fetchImpl: mock.fetchImpl, now: () => clock });
  await reader.read();
  clock += 120001;
  const next = await reader.read();
  assert.equal(mock.calls.length, 8);
  assert.equal(next.cached, false);
});

test("connection failure is sanitized and repeated clicks wait", async () => {
  const mock = upstream();
  mock.fail();
  const reader = createGithubReader({ fetchImpl: mock.fetchImpl, now: () => 1000 });
  const failed = await reader.read();
  await reader.read();
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.snapshot, null);
  assert.equal(mock.calls.length, 1);
  assert.equal(JSON.stringify(failed).includes("synthetic-private-error"), false);
});

test("an upstream failure retains explicitly stale evidence with its old timestamp", async () => {
  const mock = upstream();
  let clock = 1000;
  const reader = createGithubReader({ fetchImpl: mock.fetchImpl, now: () => clock });
  const first = await reader.read();
  clock += 120001;
  mock.fail();
  const stale = await reader.read();
  assert.equal(stale.status, "stale");
  assert.equal(stale.snapshot.observedAt, first.snapshot.observedAt);
  assert.equal(stale.error, "github_connection_failed");
});

test("rate exhaustion respects reset and never attempts token or account fallback", async () => {
  let calls = 0;
  const reader = createGithubReader({ now: () => 1000, fetchImpl: async () => {
    calls++;
    return new Response("rate limited", { status: 403,
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000" } });
  } });
  const result = await reader.read();
  await reader.read();
  assert.equal(result.error, "github_limit_or_denied");
  assert.equal(result.nextCheckAt, new Date(2000000).toISOString());
  assert.equal(calls, 1);
});

test("private or mismatched repository metadata stops further reads", async () => {
  const mock = upstream();
  mock.bodies[0].private = true;
  const result = await createGithubReader({ fetchImpl: mock.fetchImpl }).read();
  assert.equal(result.error, "github_invalid_response");
  assert.equal(mock.calls.length, 1);
});

test("untrusted commit metadata cannot construct an arbitrary API path", async () => {
  const mock = upstream();
  mock.bodies[2].head.sha = "../../another-owner/private";
  const result = await createGithubReader({ fetchImpl: mock.fetchImpl }).read();
  assert.equal(result.error, "github_invalid_response");
  assert.equal(mock.calls.length, 3);
});

test("absence of the required CI check stays unknown", async () => {
  const mock = upstream();
  mock.bodies[3] = { check_runs: [], total_count: 0 };
  const result = await createGithubReader({ fetchImpl: mock.fetchImpl }).read();
  assert.equal(result.snapshot.check, null);
});

test("missing protection metadata is unknown, never mislabeled as unprotected", async () => {
  const mock = upstream();
  delete mock.bodies[1].protected;
  const result = await createGithubReader({ fetchImpl: mock.fetchImpl }).read();
  assert.equal(result.status, "unavailable");
  assert.equal(result.snapshot, null);
  assert.equal(result.error, "github_invalid_response");
});

async function local(t) {
  let reads = 0;
  const server = createSupervisorServer({ reader: { read: async () => { reads++; return { status: "observed" }; } } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const port = server.address().port;
  function request(route, { method = "GET", headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port, path: route, method, headers }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (part) => { body += part; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on("error", reject); req.end();
    });
  }
  return { request, reads: () => reads };
}

test("local dashboard serves only its public assets with strict response policy", async (t) => {
  const { request, reads } = await local(t);
  for (const asset of ["/", "/app.js", "/style.css"]) {
    const response = await request(asset);
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.ok(response.headers["content-security-policy"].includes("script-src 'self'"));
  }
  assert.equal(reads(), 0);
});

test("only the explicit local API invokes the public connector", async (t) => {
  const { request, reads } = await local(t);
  assert.equal((await request("/api/project-zero")).status, 200);
  assert.equal(reads(), 1);
});

test("source, path traversal, env and arbitrary URLs cannot be served", async (t) => {
  const { request, reads } = await local(t);
  for (const route of ["/.env", "/supervisor/github-public.cjs", "/../netlify/functions/chat.js",
    "/%2e%2e/README.md", "/api/project-zero?url=http://169.254.169.254/", "/api/merge"]) {
    assert.equal((await request(route)).status, 404);
  }
  assert.equal(reads(), 0);
});

test("foreign Host, Origin and cross-site reads are rejected before a connector call", async (t) => {
  const { request, reads } = await local(t);
  for (const headers of [{ Host: "attacker.example" }, { Origin: "https://attacker.example" },
    { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await request("/api/project-zero", { headers })).status, 403);
  }
  assert.equal(reads(), 0);
});

test("write methods have no routes or side effects", async (t) => {
  const { request, reads } = await local(t);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await request("/api/project-zero", { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, "GET");
  }
  assert.equal(reads(), 0);
});

test("UI uses textContent for upstream strings and has no inline/external scripts", () => {
  const root = path.resolve(__dirname, "..", "supervisor", "public");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(app), false);
  assert.ok(app.includes(".textContent = value"));
  assert.equal(/<script(?![^>]*src=)/.test(html), false);
  assert.equal(/<script[^>]*src=["']https?:/.test(html), false);
});
