"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createGithubReader } = require("./github-public.cjs");
const { diagnose } = require("./diagnostics.cjs");
const { createHistoryStore } = require("./history.cjs");
const { createTaskStore } = require("./tasks.cjs");
const { createLocalAuth } = require("./auth.cjs");
const { randomBytes } = require("node:crypto");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);
const HEADERS = {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []; let rejected = false;
    req.on("data", (part) => {
      if (rejected) return;
      size += part.length;
      if (size > 4096) { rejected = true; reject(new Error("body_too_large")); return; }
      chunks.push(part);
    });
    req.on("end", () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", () => reject(new Error("invalid_json")));
    req.on("aborted", () => reject(new Error("invalid_json")));
  });
}
function createSupervisorServer({ reader = createGithubReader(), history = createHistoryStore(), tasks = createTaskStore(), auth = createLocalAuth() } = {}) {
  const csrfToken = randomBytes(32).toString("hex");
  return http.createServer(async (req, res) => {
    const port = res.socket.localPort;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origin = req.headers.origin;
    function send(status, value, type = "application/json; charset=utf-8", extra = {}) {
      res.writeHead(status, { ...HEADERS, "Content-Type": type, ...extra });
      res.end(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
    }
    if (!hosts.has(req.headers.host) ||
        (origin && ![...hosts].some((host) => origin === `http://${host}`)) ||
        req.headers["sec-fetch-site"] === "cross-site") {
      send(403, { error: "local_origin_required" }); return;
    }
    function writeAllowed() {
      if (!origin || req.headers["x-supervisor-csrf"] !== csrfToken) { send(403, { error: "local_write_token_required" }); return false; }
      if ((req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
        send(415, { error: "json_required" }); return false;
      }
      return true;
    }
    if (req.url === "/api/auth" && req.method === "GET") {
      try { send(200, { configured: auth.configured(), authenticated: auth.authenticated(req.headers.cookie), csrfToken }); }
      catch { send(503, { error: "auth_unavailable" }); }
      return;
    }
    if (req.url === "/api/auth" && req.method === "POST") {
      if (!writeAllowed()) return;
      try {
        const body = await readJson(req);
        if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("invalid_json");
        let cookie;
        if (body.action === "activity" && Object.keys(body).length === 1) {
          auth.touch(req.headers.cookie); send(200, { authenticated: true }); return;
        }
        if (body.action === "logout" && Object.keys(body).length === 1) cookie = auth.logout(req.headers.cookie);
        else if (["setup", "login"].includes(body.action) && Object.keys(body).length === 2) cookie = await auth.enter(body.action, body.password);
        else throw new Error("invalid_action");
        send(200, { authenticated: body.action !== "logout" }, undefined, { "Set-Cookie": cookie });
      } catch (error) {
        const codes = { body_too_large: 413, invalid_json: 400, invalid_action: 400, auth_password_invalid: 400,
          auth_invalid_login: 401, auth_login_required: 401, auth_setup_required: 409, auth_already_configured: 409, auth_try_later: 429 };
        send(codes[error.message] || 503, { error: codes[error.message] ? error.message : "auth_unavailable" });
      }
      return;
    }
    if (["/api/tasks", "/api/history", "/api/project-zero"].includes(req.url)) {
      try {
        if (!auth.authenticated(req.headers.cookie)) { send(401, { error: "login_required" }); return; }
        auth.touch?.(req.headers.cookie);
      }
      catch { send(503, { error: "auth_unavailable" }); return; }
    }
    if (req.url === "/api/tasks" && req.method === "POST") {
      if (!writeAllowed()) return;
      try {
        const body = await readJson(req);
        if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("invalid_json");
        let updated;
        if (body.action === "create" && Object.keys(body).length === 2) updated = tasks.create(body.title);
        else if (body.action === "status" && Object.keys(body).length === 3) updated = tasks.update(body.id, body.status);
        else throw new Error("invalid_action");
        send(200, { tasks: updated, verification: "owner_reported" });
      } catch (error) {
        const codes = { body_too_large: 413, invalid_json: 400, invalid_action: 400,
          tasks_invalid_title: 400, tasks_invalid_status: 400, tasks_not_found: 404, tasks_limit: 409 };
        send(codes[error.message] || 503, { error: codes[error.message] ? error.message : "tasks_unavailable" });
      }
      return;
    }
    if (req.method !== "GET") { send(405, { error: "method_not_allowed" }, undefined, { Allow: ["/api/tasks", "/api/auth"].includes(req.url) ? "GET, POST" : "GET" }); return; }
    if (req.url === "/api/tasks") {
      try { send(200, { tasks: tasks.read(), csrfToken, verification: "owner_reported" }); }
      catch { send(503, { error: "tasks_unavailable" }); }
      return;
    }
    function historyResult(action) {
      try { return action(); }
      catch { return { status: "unavailable", items: [], changes: [], comparisonAvailable: false }; }
    }
    if (req.url === "/api/history") { send(200, historyResult(() => history.read())); return; }
    if (req.url === "/api/project-zero") {
      try {
        const result = await reader.read();
        send(200, { ...result, analysis: diagnose(result), history: historyResult(() => history.record(result)) });
      }
      catch { send(503, { error: "local_reader_failed" }); }
      return;
    }
    const asset = assets.get(req.url);
    if (!asset) { send(404, { error: "not_found" }); return; }
    try { send(200, fs.readFileSync(path.join(__dirname, "public", asset[0])), asset[1]); }
    catch { send(500, { error: "local_asset_unavailable" }); }
  });
}

module.exports = { createSupervisorServer };
