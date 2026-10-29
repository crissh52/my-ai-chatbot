"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os");
const { createProjectStore } = require("../supervisor/projects.cjs");
const { createSupervisorServer } = require("../supervisor/server.cjs");
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir()); const root = fs.mkdtempSync(path.join(parent, "supervisor-projects-"));
  t.after(() => { const target = fs.realpathSync(root); assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith("supervisor-projects-")); assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true }); });
  return { root, file: path.join(root, ".netlify", "supervisor-projects", "projects.json") };
}
test("Project Zero exists without writing or probing a remote service", (t) => {
  const { root, file } = fixture(t); const result = createProjectStore({ root }).read();
  assert.equal(result.length, 1); assert.equal(result[0].id, "project-zero"); assert.equal(fs.existsSync(file), false);
});
test("registered metadata persists and remains explicitly unconnected", (t) => {
  const { root } = fixture(t); const items = createProjectStore({ root }).create(" Local Project ", " Example/Repo ");
  assert.equal(items[1].repository, "example/repo"); assert.equal(items[1].connection, "not_connected");
  assert.deepEqual(createProjectStore({ root }).read(), items);
});
test("duplicate repositories are rejected regardless of case", (t) => {
  const { root } = fixture(t); const store = createProjectStore({ root }); store.create("One", "example/repo");
  assert.throws(() => store.create("Two", "EXAMPLE/REPO"), /projects_duplicate/);
  assert.throws(() => store.create("Copy", "CRISSH52/my-ai-chatbot"), /projects_duplicate/);
});
test("arbitrary URLs and credentials cannot be registered as a repository", (t) => {
  const { root, file } = fixture(t); const store = createProjectStore({ root });
  for (const repo of ["https://github.com/owner/repo", "http://127.0.0.1/admin", "owner/repo?token=synthetic", "owner/..", "owner/repo/extra", "owner/re\npo"]) {
    assert.throws(() => store.create("Reject", repo));
  }
  assert.equal(fs.existsSync(file), false);
});
test("a project without a repository is honest local metadata, not a fabricated connection", (t) => {
  const { root } = fixture(t); const store = createProjectStore({ root });
  store.create("My planned site", ""); const items = store.create("Another local project", "");
  assert.equal(items.length, 3); assert.equal(items[1].repository, ""); assert.equal(items[1].connection, "not_connected");
  assert.equal(createProjectStore({ root }).read().length, 3);
});
test("invalid names do not create project data", (t) => {
  const { root, file } = fixture(t); const store = createProjectStore({ root });
  for (const name of ["", "  ", "a".repeat(81), "internal\nnewline", null]) assert.throws(() => store.create(name, "example/repo"));
  assert.equal(fs.existsSync(file), false);
});
test("hide and restore preserve identity and metadata", (t) => {
  const { root } = fixture(t); const store = createProjectStore({ root }); const first = store.create("One", "example/repo")[1];
  assert.equal(store.archive(first.id, true)[1].archived, true);
  const restored = store.archive(first.id, false)[1]; assert.equal(restored.id, first.id);
  assert.equal(restored.createdAt, first.createdAt); assert.equal(restored.archived, false);
});
test("Project Zero cannot be hidden and unknown entries cannot be created by archive", (t) => {
  const { root } = fixture(t); const store = createProjectStore({ root });
  assert.throws(() => store.archive("project-zero", true), /projects_zero_fixed/);
  assert.throws(() => store.archive("unknown", false), /projects_not_found/);
});
test("cap counts hidden entries and never discards old projects", (t) => {
  const { root } = fixture(t); const store = createProjectStore({ root });
  for (let i = 0; i < 19; i++) store.create(`Project ${i}`, `example/repo-${i}`);
  store.archive(store.read()[1].id, true);
  assert.throws(() => store.create("Overflow", "example/overflow"), /projects_limit/); assert.equal(store.read().length, 20);
});
test("malformed existing registry is preserved", (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "synthetic corrupt registry");
  assert.throws(() => createProjectStore({ root }).create("One", "example/repo"));
  assert.equal(fs.readFileSync(file, "utf8"), "synthetic corrupt registry");
});
test("linked directory cannot redirect registry writes", (t) => {
  const { root } = fixture(t); const outside = path.join(root, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, ".netlify"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => createProjectStore({ root }).create("One", "example/repo")); assert.deepEqual(fs.readdirSync(outside), []);
});
async function local(t) {
  const { root } = fixture(t); let upstream = 0;
  const server = createSupervisorServer({ projects: createProjectStore({ root }),
    auth: { configured: () => true, authenticated: () => true },
    reader: { read: async () => { upstream++; throw new Error("No upstream allowed"); } } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = await (await fetch(base + "/api/auth")).json();
  const headers = { Origin: base, "Content-Type": "application/json", "X-Supervisor-CSRF": auth.csrfToken };
  const post = (body, custom = headers) => fetch(base + "/api/projects", { method: "POST", headers: custom, body: JSON.stringify(body) });
  return { base, headers, post, upstream: () => upstream };
}
test("registry API create/hide/restore never invokes a connector", async (t) => {
  const { post, upstream } = await local(t);
  const result = await (await post({ action: "create", name: "<b>synthetic</b>", repository: "example/repo" })).json();
  const id = result.projects[1].id;
  assert.equal((await post({ action: "archive", id, archived: true })).status, 200);
  const restored = await (await post({ action: "archive", id, archived: false })).json();
  assert.equal(restored.projects[1].connection, "not_connected"); assert.equal(upstream(), 0);
});
test("registry writes require CSRF, Origin and JSON", async (t) => {
  const { post, headers } = await local(t); const body = { action: "create", name: "Reject", repository: "example/repo" };
  assert.equal((await post(body, { ...headers, "X-Supervisor-CSRF": "wrong" })).status, 403);
  assert.equal((await post(body, { ...headers, Origin: "https://other.example" })).status, 403);
  assert.equal((await post(body, { ...headers, "Content-Type": "text/plain" })).status, 415);
});
test("unsupported fields cannot turn metadata into a connection action", async (t) => {
  const { post, upstream } = await local(t);
  assert.equal((await post({ action: "connect", repository: "example/repo" })).status, 400);
  assert.equal((await post({ action: "create", name: "Reject", repository: "example/repo", token: "synthetic" })).status, 400);
  assert.equal(upstream(), 0);
});
