"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../supervisor/public/app.js"), "utf8");
async function page({ authenticated = false } = {}) {
  let clock = 1000; let reloads = 0; const nodes = new Map(); const windowEvents = {}; const documentEvents = {};
  const timers = []; const requests = []; const broadcasts = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: "", hidden: false, disabled: false, textContent: "", children: [], events: {},
      addEventListener(name, callback) { this.events[name] = callback; }, setAttribute() {},
      replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } });
    return nodes.get(id);
  }
  class Clock extends Date { static now() { return clock; } }
  class Channel { constructor() { broadcasts.push(this); } postMessage(value) { this.lastMessage = value; } }
  const context = { Date: Clock, AbortSignal, BroadcastChannel: Channel, setInterval: (fn) => timers.push(fn), setTimeout,
    document: { getElementById: node, createElement: () => node(`created-${nodes.size}`), visibilityState: "visible",
      addEventListener: (name, callback) => { documentEvents[name] = callback; } },
    window: { addEventListener: (name, callback) => { windowEvents[name] = callback; } },
    location: { reload: () => { reloads++; } },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      const result = url === "/api/auth" ? options.method === "POST" ? { authenticated: false }
        : { configured: true, authenticated, csrfToken: "synthetic-local-token" }
        : url === "/api/tasks" ? { tasks: [], csrfToken: "synthetic-local-token" }
        : { status: "available", items: [], changes: [], retention: 50, comparisonAvailable: false };
      return { ok: true, status: 200, json: async () => result };
    } };
  vm.runInNewContext(source, context, { timeout: 1000 });
  const settle = () => new Promise((resolve) => setImmediate(resolve)); await settle();
  return { node, windowEvents, documentEvents, timers, requests, broadcasts, settle,
    clock: (value) => { clock = value; }, reloads: () => reloads };
}
test("page show and restored navigation clear synthetic password values", async () => {
  const p = await page(); p.node("auth-password").value = "synthetic autofill"; p.node("auth-confirm").value = "synthetic repeat";
  p.windowEvents.pageshow({ persisted: false });
  assert.equal(p.node("auth-password").value, ""); assert.equal(p.node("auth-confirm").value, "");
  p.windowEvents.pageshow({ persisted: true }); assert.equal(p.reloads(), 1);
});
test("logout hides and clears private content before the request resolves", async () => {
  const p = await page({ authenticated: true }); p.node("auth-password").value = "synthetic value";
  p.node("task-title").value = "synthetic unsaved note"; p.node("task-list").children.push("synthetic private row");
  p.node("logout").events.click();
  assert.equal(p.node("workspace").hidden, true); assert.equal(p.node("auth-password").value, "");
  assert.equal(p.node("task-title").value, ""); assert.equal(p.node("task-list").children.length, 0);
  await p.settle(); assert.equal(p.reloads(), 1); assert.equal(p.broadcasts[0].lastMessage.type, "locked");
});
test("unattended UI locks without a synthetic activity event keeping it alive", async () => {
  const p = await page({ authenticated: true }); p.clock(302000);
  p.documentEvents.pointermove({ isTrusted: false }); p.timers[0](); await p.settle();
  assert.equal(p.node("workspace").hidden, true);
  assert.ok(p.requests.some((r) => r.options.body === JSON.stringify({ action: "logout" })));
});
test("auth status polling sends no activity keepalive", async () => {
  const p = await page({ authenticated: true }); p.clock(17000); p.timers[0](); await p.settle();
  assert.equal(p.requests.some((r) => r.options.body === JSON.stringify({ action: "activity" })), false);
});
test("trusted interaction acknowledges activity with throttling, never background refresh", async () => {
  const p = await page({ authenticated: true }); p.clock(32000);
  p.documentEvents.keydown({ isTrusted: true });
  p.documentEvents.pointermove({ isTrusted: true }); await p.settle();
  assert.equal(p.requests.filter((r) => r.options.body === JSON.stringify({ action: "activity" })).length, 1);
  assert.ok(p.requests.every((r) => r.url.startsWith("/api/")));
});
test("lock from another tab clears this tab without disclosing data", async () => {
  const p = await page({ authenticated: true }); p.broadcasts[0].onmessage({ data: { type: "locked" } });
  assert.equal(p.node("workspace").hidden, true); assert.equal(p.reloads(), 1);
});
test("login asks for no autofill without claiming to control password managers", async () => {
  const p = await page(); assert.equal(p.node("auth-password").autocomplete, "off");
});
