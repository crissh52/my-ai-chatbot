"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createGithubReader } = require("./github-public.cjs");
const { diagnose } = require("./diagnostics.cjs");
const { createHistoryStore } = require("./history.cjs");
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

function createSupervisorServer({ reader = createGithubReader(), history = createHistoryStore() } = {}) {
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
    if (req.method !== "GET") { send(405, { error: "method_not_allowed" }, undefined, { Allow: "GET" }); return; }
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
