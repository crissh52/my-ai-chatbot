"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHistoryStore } = require("../supervisor/history.cjs");
const { createSupervisorServer } = require("../supervisor/server.cjs");
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "supervisor-history-"));
  t.after(() => {
    const target = fs.realpathSync(root);
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith("supervisor-history-"));
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true });
  });
  return { root, file: path.join(root, ".netlify", "supervisor-history", "history.json") };
}
function observation(second = 0) {
  return { status: "observed", snapshot: { observedAt: new Date(1700000000000 + second * 1000).toISOString(),
    repository: "crissh52/my-ai-chatbot", main: { sha: "a".repeat(40), protected: true },
    pull: { number: 2, sha: "b".repeat(40), state: "open", draft: true, merged: false },
    check: { status: "completed", conclusion: "success" } } };
}
test("an empty history needs no directory or upstream call", (t) => {
  const { root } = fixture(t);
  assert.deepEqual(createHistoryStore({ root }).read().items, []);
  assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
});
test("observations survive creating a new store instance", (t) => {
  const { root } = fixture(t);
  createHistoryStore({ root }).record(observation());
  assert.equal(createHistoryStore({ root }).read().items[0].mainSha, "a".repeat(40));
});
test("cached observations are deduplicated", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root });
  store.record(observation()); store.record({ ...observation(), cached: true });
  assert.equal(store.read().items.length, 1);
});
test("stale and unavailable observations never add a record", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root });
  store.record(observation());
  for (const status of ["stale", "unavailable"]) store.record({ ...observation(1), status });
  assert.equal(store.read().items.length, 1);
});
test("retention is bounded and keeps the most recent observations", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root, limit: 3 });
  for (let i = 0; i < 5; i++) store.record(observation(i));
  assert.equal(store.read().items.length, 3);
  assert.equal(store.read().items[0].observedAt, observation(4).snapshot.observedAt);
  assert.equal(store.read().items[2].observedAt, observation(2).snapshot.observedAt);
});
test("comparison identifies changed CI without claiming a repair", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root });
  store.record(observation()); const next = observation(1); next.snapshot.check.conclusion = "failure";
  const result = store.record(next);
  assert.deepEqual(result.changes, [{ field: "ciConclusion", before: "success", after: "failure" }]);
});
test("new observation time alone does not count as a state change", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root });
  store.record(observation()); const result = store.record(observation(1));
  assert.equal(result.comparisonAvailable, true); assert.deepEqual(result.changes, []);
});
test("older evidence cannot replace the newest record", (t) => {
  const { root } = fixture(t); const store = createHistoryStore({ root });
  store.record(observation(2)); store.record(observation(1));
  assert.equal(store.read().items.length, 1);
  assert.equal(store.read().items[0].observedAt, observation(2).snapshot.observedAt);
});
test("only minimized fields are persisted", (t) => {
  const { root, file } = fixture(t); const input = observation();
  input.snapshot.secret = "synthetic-private-note"; input.snapshot.pull.title = "synthetic-private-note";
  createHistoryStore({ root }).record(input);
  assert.equal(fs.readFileSync(file, "utf8").includes("synthetic-private-note"), false);
});
test("another project cannot be stored under Project Zero", (t) => {
  const { root } = fixture(t); const input = observation(); input.snapshot.repository = "someone/else";
  const store = createHistoryStore({ root });
  assert.throws(() => store.record(input)); assert.deepEqual(store.read().items, []);
});
test("corrupt existing data is preserved rather than overwritten", (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "invalid synthetic data");
  assert.throws(() => createHistoryStore({ root }).record(observation()));
  assert.equal(fs.readFileSync(file, "utf8"), "invalid synthetic data");
});
test("oversized existing data is rejected without altering it", (t) => {
  const { root, file } = fixture(t); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x".repeat(1000001));
  assert.throws(() => createHistoryStore({ root }).read());
  assert.equal(fs.statSync(file).size, 1000001);
});
test("linked parent cannot redirect history writes", (t) => {
  const { root } = fixture(t); const outside = path.join(root, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, ".netlify"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => createHistoryStore({ root }).record(observation()));
  assert.deepEqual(fs.readdirSync(outside), []);
});
test("history endpoint survives restart without collecting GitHub again", async (t) => {
  const { root } = fixture(t); let reads = 0;
  const history = createHistoryStore({ root }); history.record(observation());
  const server = createSupervisorServer({ auth: { authenticated: () => true }, history: createHistoryStore({ root }),
    reader: { read: async () => { reads++; return observation(); } } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/history`);
  assert.equal((await response.json()).items.length, 1); assert.equal(reads, 0);
});
