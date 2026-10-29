"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os");
const { createLocalAuth } = require("../supervisor/auth.cjs");
const { createSupervisorServer } = require("../supervisor/server.cjs");
const PASSWORD = "synthetic local password for tests";
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir()); const root = fs.mkdtempSync(path.join(parent, "supervisor-auth-"));
  t.after(() => { const target = fs.realpathSync(root); assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith("supervisor-auth-")); assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true }); });
  return { root, file: path.join(root, ".netlify", "supervisor-auth", "auth.json") };
}
test("setup stores a salted hash, never the synthetic password", async (t) => {
  const { root, file } = fixture(t); const auth = createLocalAuth({ root });
  const cookie = await auth.enter("setup", PASSWORD);
  assert.equal(auth.configured(), true); assert.equal(auth.authenticated(cookie), true);
  const stored = fs.readFileSync(file, "utf8"); assert.equal(stored.includes(PASSWORD), false);
  const value = JSON.parse(stored); assert.equal(value.salt.length, 32); assert.equal(value.hash.length, 64);
  assert.ok(cookie.includes("HttpOnly")); assert.ok(cookie.includes("SameSite=Strict"));
});
test("setup cannot overwrite an existing owner credential", async (t) => {
  const { root, file } = fixture(t); const auth = createLocalAuth({ root }); await auth.enter("setup", PASSWORD);
  const before = fs.readFileSync(file, "utf8"); await assert.rejects(auth.enter("setup", PASSWORD + " other"));
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
test("incorrect password does not create a session", async (t) => {
  const { root } = fixture(t); const auth = createLocalAuth({ root }); await auth.enter("setup", PASSWORD);
  await assert.rejects(auth.enter("login", "synthetic wrong password"), /auth_invalid_login/);
  assert.equal(auth.authenticated("supervisor_local_session=" + "a".repeat(64)), false);
});
test("session expires server-side", async (t) => {
  const { root } = fixture(t); let clock = 1000; const auth = createLocalAuth({ root, now: () => clock, sessionMs: 2000 });
  const cookie = await auth.enter("setup", PASSWORD); clock += 2001;
  assert.equal(auth.authenticated(cookie), false);
});
test("idle session expires even when the absolute lifetime remains", async (t) => {
  const { root } = fixture(t); let clock = 1000;
  const auth = createLocalAuth({ root, now: () => clock, idleMs: 1000, sessionMs: 100000 });
  const cookie = await auth.enter("setup", PASSWORD); clock += 1001;
  assert.equal(auth.authenticated(cookie), false);
  assert.throws(() => auth.touch(cookie), /auth_login_required/);
});
test("checking session status does not keep an unattended session alive", async (t) => {
  const { root } = fixture(t); let clock = 1000;
  const auth = createLocalAuth({ root, now: () => clock, idleMs: 1000 });
  const cookie = await auth.enter("setup", PASSWORD);
  clock += 800; assert.equal(auth.authenticated(cookie), true);
  clock += 201; assert.equal(auth.authenticated(cookie), false);
});
test("acknowledged activity extends idle time but never absolute lifetime", async (t) => {
  const { root } = fixture(t); let clock = 1000;
  const auth = createLocalAuth({ root, now: () => clock, idleMs: 1000, sessionMs: 2000 });
  const cookie = await auth.enter("setup", PASSWORD);
  clock += 800; auth.touch(cookie); clock += 800; assert.equal(auth.authenticated(cookie), true);
  auth.touch(cookie); clock += 401; assert.equal(auth.authenticated(cookie), false);
});
test("logout invalidates the server session", async (t) => {
  const { root } = fixture(t); const auth = createLocalAuth({ root }); const cookie = await auth.enter("setup", PASSWORD);
  const cleared = auth.logout(cookie); assert.ok(cleared.includes("Max-Age=0")); assert.equal(auth.authenticated(cookie), false);
});
test("a new login revokes the prior personal session", async (t) => {
  const { root } = fixture(t); const auth = createLocalAuth({ root }); const first = await auth.enter("setup", PASSWORD);
  const next = await auth.enter("login", PASSWORD); assert.notEqual(first, next);
  assert.equal(auth.authenticated(first), false); assert.equal(auth.authenticated(next), true);
});
test("restart preserves the account but invalidates sessions", async (t) => {
  const { root } = fixture(t); const first = createLocalAuth({ root }); const cookie = await first.enter("setup", PASSWORD);
  const restarted = createLocalAuth({ root }); assert.equal(restarted.configured(), true);
  assert.equal(restarted.authenticated(cookie), false); assert.equal(restarted.authenticated(await restarted.enter("login", PASSWORD)), true);
});
test("five failed passwords trigger a cooldown", async (t) => {
  const { root } = fixture(t); let clock = 1000; const auth = createLocalAuth({ root, now: () => clock });
  await auth.enter("setup", PASSWORD);
  for (let i = 0; i < 5; i++) await assert.rejects(auth.enter("login", PASSWORD + " wrong"));
  await assert.rejects(auth.enter("login", PASSWORD), /auth_try_later/);
  clock += 15 * 60 * 1000 + 1; assert.ok(await auth.enter("login", PASSWORD));
});
test("concurrent expensive login attempts are bounded", async (t) => {
  const { root } = fixture(t); const auth = createLocalAuth({ root }); await auth.enter("setup", PASSWORD);
  const pending = auth.enter("login", PASSWORD); await assert.rejects(auth.enter("login", PASSWORD), /auth_try_later/); await pending;
});
test("malformed auth file is preserved and never offered as fresh setup", (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "synthetic corrupt config");
  const auth = createLocalAuth({ root }); assert.throws(() => auth.configured()); assert.throws(() => auth.authenticated(""));
  assert.equal(fs.readFileSync(file, "utf8"), "synthetic corrupt config");
});
test("linked credential parent cannot redirect setup writes", async (t) => {
  const { root } = fixture(t); const outside = path.join(root, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, ".netlify"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createLocalAuth({ root }).enter("setup", PASSWORD)); assert.deepEqual(fs.readdirSync(outside), []);
});
test("short or oversized passwords cannot create an account", async (t) => {
  const { root, file } = fixture(t); const auth = createLocalAuth({ root });
  for (const value of ["short", "a".repeat(129), null]) await assert.rejects(auth.enter("setup", value));
  assert.equal(fs.existsSync(file), false);
});
async function local(t) {
  const { root } = fixture(t); let reads = 0;
  const server = createSupervisorServer({ auth: createLocalAuth({ root }),
    tasks: { read: () => [{ title: "synthetic protected item" }] }, history: { read: () => ({ items: [] }) },
    reader: { read: async () => { reads++; return { status: "unavailable", snapshot: null }; } } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const state = await (await fetch(base + "/api/auth")).json();
  const headers = { Origin: base, "Content-Type": "application/json", "X-Supervisor-CSRF": state.csrfToken };
  const post = (body, custom = headers) => fetch(base + "/api/auth", { method: "POST", headers: custom, body: JSON.stringify(body) });
  return { base, state, headers, post, reads: () => reads };
}
test("default server denies all protected APIs before login without upstream calls", async (t) => {
  const { base, state, reads } = await local(t); assert.equal(state.configured, false);
  for (const route of ["/api/tasks", "/api/history", "/api/project-zero"]) {
    const response = await fetch(base + route); assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: "login_required" });
  }
  assert.equal((await fetch(base)).status, 200); assert.equal(reads(), 0);
});
test("real auth HTTP setup permits reads, logout revokes them", async (t) => {
  const { base, post, headers } = await local(t);
  const setup = await post({ action: "setup", password: PASSWORD }); assert.equal(setup.status, 200);
  const cookie = setup.headers.get("set-cookie").split(";")[0];
  const tasks = await fetch(base + "/api/tasks", { headers: { Cookie: cookie } }); assert.equal(tasks.status, 200);
  assert.equal((await tasks.json()).tasks[0].title, "synthetic protected item");
  const logout = await post({ action: "logout" }, { ...headers, Cookie: cookie }); assert.equal(logout.status, 200);
  assert.equal((await fetch(base + "/api/tasks", { headers: { Cookie: cookie } })).status, 401);
});
test("auth mutations require local Origin, CSRF and JSON", async (t) => {
  const { post, headers } = await local(t); const body = { action: "setup", password: PASSWORD };
  assert.equal((await post(body, { ...headers, Origin: "https://other.example" })).status, 403);
  assert.equal((await post(body, { ...headers, "X-Supervisor-CSRF": "wrong" })).status, 403);
  assert.equal((await post(body, { ...headers, "Content-Type": "text/plain" })).status, 415);
});
test("auth responses never disclose credential hashes or password values", async (t) => {
  const { base, post } = await local(t); await post({ action: "setup", password: PASSWORD });
  const state = await (await fetch(base + "/api/auth")).json();
  assert.deepEqual(Object.keys(state).sort(), ["authenticated", "configured", "csrfToken"]);
  assert.equal(JSON.stringify(state).includes(PASSWORD), false);
});
test("activity endpoint cannot revive an anonymous session", async (t) => {
  const { post, headers } = await local(t);
  assert.equal((await post({ action: "activity" })).status, 401);
  const setup = await post({ action: "setup", password: PASSWORD });
  const cookie = setup.headers.get("set-cookie").split(";")[0];
  const touched = await post({ action: "activity" }, { ...headers, Cookie: cookie });
  assert.equal(touched.status, 200); assert.equal(touched.headers.get("set-cookie"), null);
});
