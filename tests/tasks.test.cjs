"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os");
const { createTaskStore } = require("../supervisor/tasks.cjs");
const { createSupervisorServer } = require("../supervisor/server.cjs");
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir()); const root = fs.mkdtempSync(path.join(parent, "supervisor-tasks-"));
  t.after(() => { const target = fs.realpathSync(root); assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith("supervisor-tasks-")); assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true }); });
  return { root, file: path.join(root, ".netlify", "supervisor-tasks", "tasks.json") };
}
test("task creation persists across a new store instance", (t) => {
  const { root } = fixture(t); const tasks = createTaskStore({ root }).create("  Review CI  ");
  assert.equal(tasks[0].title, "Review CI"); assert.equal(tasks[0].status, "todo");
  assert.deepEqual(createTaskStore({ root }).read(), tasks);
});
test("owner can mark done and reopen without claiming execution verification", (t) => {
  const { root } = fixture(t); const store = createTaskStore({ root }); const id = store.create("Review")[0].id;
  for (const status of ["doing", "done", "todo"]) assert.equal(store.update(id, status)[0].status, status);
});
test("invalid titles cannot create data files", (t) => {
  const { root, file } = fixture(t); const store = createTaskStore({ root });
  for (const title of ["", "   ", "a".repeat(161), "line\nbreak", null]) assert.throws(() => store.create(title));
  assert.equal(fs.existsSync(file), false);
});
test("invalid status and unknown task preserve existing data", (t) => {
  const { root, file } = fixture(t); const store = createTaskStore({ root }); const id = store.create("Keep")[0].id;
  const before = fs.readFileSync(file, "utf8");
  assert.throws(() => store.update(id, "verified")); assert.throws(() => store.update("unknown", "done"));
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
test("100-task cap rejects creation without deleting older tasks", (t) => {
  const { root } = fixture(t); const store = createTaskStore({ root });
  for (let i = 0; i < 100; i++) store.create(`Task ${i}`);
  assert.throws(() => store.create("Overflow"), /tasks_limit/); assert.equal(store.read().length, 100);
});
test("malformed existing task file is preserved", (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "broken fixture");
  assert.throws(() => createTaskStore({ root }).create("New")); assert.equal(fs.readFileSync(file, "utf8"), "broken fixture");
});
test("task directory links cannot redirect a write", (t) => {
  const { root } = fixture(t); const outside = path.join(root, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, ".netlify"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => createTaskStore({ root }).create("Test")); assert.deepEqual(fs.readdirSync(outside), []);
});
async function local(t) {
  const { root } = fixture(t); let reads = 0;
  const server = createSupervisorServer({ tasks: createTaskStore({ root }), reader: { read: async () => { reads++; throw new Error("No upstream calls allowed"); } } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const initial = await (await fetch(base + "/api/tasks")).json();
  const headers = { Origin: base, "Content-Type": "application/json", "X-Supervisor-CSRF": initial.csrfToken };
  const post = (body, custom = headers) => fetch(base + "/api/tasks", { method: "POST", headers: custom, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { base, headers, post, reads: () => reads };
}
test("task API create/status works only locally without upstream calls", async (t) => {
  const { post, reads } = await local(t);
  const created = await (await post({ action: "create", title: "<script>synthetic</script>" })).json();
  assert.equal(created.tasks[0].status, "todo"); assert.equal(created.verification, "owner_reported");
  const updated = await (await post({ action: "status", id: created.tasks[0].id, status: "done" })).json();
  assert.equal(updated.tasks[0].status, "done"); assert.equal(reads(), 0);
});
test("missing or invalid write token is rejected", async (t) => {
  const { post, headers } = await local(t);
  for (const token of ["", "wrong"]) assert.equal((await post({ action: "create", title: "Reject" }, { ...headers, "X-Supervisor-CSRF": token })).status, 403);
});
test("missing or foreign Origin cannot write even with a valid token", async (t) => {
  const { post, headers } = await local(t); const missing = { ...headers }; delete missing.Origin;
  assert.equal((await post({ action: "create", title: "Reject" }, missing)).status, 403);
  assert.equal((await post({ action: "create", title: "Reject" }, { ...headers, Origin: "https://other.example" })).status, 403);
});
test("form content types cannot use the local write endpoint", async (t) => {
  const { post, headers } = await local(t);
  assert.equal((await post("action=create", { ...headers, "Content-Type": "text/plain" })).status, 415);
});
test("oversized and invalid JSON are rejected before mutation", async (t) => {
  const { post, base } = await local(t);
  assert.equal((await post("x".repeat(5000))).status, 413);
  assert.equal((await post("not json")).status, 400);
  assert.equal((await (await fetch(base + "/api/tasks")).json()).tasks.length, 0);
});
test("unknown actions and unexpected fields cannot mutate tasks", async (t) => {
  const { post } = await local(t);
  assert.equal((await post({ action: "delete", id: "unknown" })).status, 400);
  assert.equal((await post({ action: "create", title: "Reject", extra: "not allowed" })).status, 400);
});
test("filesystem errors expose no path or raw file content", async (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "synthetic-private-marker");
  const server = createSupervisorServer({ tasks: createTaskStore({ root }) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "tasks_unavailable" });
});
