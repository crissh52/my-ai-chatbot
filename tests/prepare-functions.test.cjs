"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { prepareFunctions } = require("../scripts/prepare-functions.cjs");
const project = path.resolve(__dirname, "..");

function fixture(t, { copyFunctions = true } = {}) {
  const temporaryParent = fs.realpathSync(os.tmpdir());
  const holder = fs.mkdtempSync(path.join(temporaryParent, "supervisor-functions-"));
  const root = path.join(holder, "project");
  fs.mkdirSync(path.join(root, "netlify"), { recursive: true });
  if (copyFunctions) {
    fs.mkdirSync(path.join(root, "netlify", "functions"));
    for (const name of ["health.js", "chat.js"]) {
      fs.copyFileSync(path.join(project, "netlify", "functions", name),
        path.join(root, "netlify", "functions", name));
    }
  }
  t.after(() => {
    // Resolve and constrain recursive cleanup to this test's own temporary tree.
    const target = fs.realpathSync(holder);
    assert.equal(path.dirname(target), temporaryParent);
    assert.ok(path.basename(target).startsWith("supervisor-functions-"));
    assert.equal(fs.lstatSync(holder).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true });
  });
  return { holder, root, output: path.join(root, ".netlify", "supervisor-functions") };
}

function assertFiles(output, expected) {
  assert.deepEqual(fs.readdirSync(output).sort(), [...expected].sort());
}

test("production packages both original handlers byte for byte", (t) => {
  const { root, output } = fixture(t);
  prepareFunctions({ root, env: { CONTEXT: "production", NETLIFY: "true" } });
  assertFiles(output, ["health.js", "chat.js"]);
  for (const name of ["health.js", "chat.js"]) {
    assert.deepEqual(fs.readFileSync(path.join(output, name)),
      fs.readFileSync(path.join(root, "netlify", "functions", name)));
  }
});

for (const context of ["deploy-preview", "branch-deploy", "dev"]) {
  test(`${context} excludes the AI handler even after a production build`, (t) => {
    const { root, output } = fixture(t);
    prepareFunctions({ root, env: { CONTEXT: "production", NETLIFY: "true" } });
    prepareFunctions({ root, env: { CONTEXT: context } });
    assertFiles(output, ["health.js"]);
  });
}

for (const flag of ["NETLIFY_PREVIEW_SERVER", "PULL_REQUEST"]) {
  test(`${flag} blocks chat even with production context metadata`, (t) => {
    const { root, output } = fixture(t);
    prepareFunctions({ root, env: { CONTEXT: "production", NETLIFY: "true", [flag]: "true" } });
    assertFiles(output, ["health.js"]);
  });
}

for (const context of [undefined, "unexpected-context"]) {
  test(`missing or unsupported context fails before creating output: ${context}`, (t) => {
    const { root } = fixture(t);
    assert.throws(() => prepareFunctions({ root, env: { CONTEXT: context } }), /CONTEXT/);
    assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
  });
}

test("an unverified production environment cannot package chat", (t) => {
  const { root } = fixture(t);
  assert.throws(() => prepareFunctions({ root, env: { CONTEXT: "production" } }), /Netlify/);
  assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
});

test("packaging never reads the provider key", (t) => {
  const { root, output } = fixture(t);
  const env = { CONTEXT: "production", NETLIFY: "true" };
  Object.defineProperty(env, "GEMINI_API_KEY", {
    get() { throw new Error("The build must not read credentials"); },
  });
  prepareFunctions({ root, env });
  assertFiles(output, ["health.js", "chat.js"]);
});

test("unexpected output is preserved and aborts packaging", (t) => {
  const { root, output } = fixture(t);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "owner-file.txt"), "keep this");
  assert.throws(() => prepareFunctions({ root, env: { CONTEXT: "deploy-preview" } }), /Unexpected/);
  assert.equal(fs.readFileSync(path.join(output, "owner-file.txt"), "utf8"), "keep this");
});

test("output links cannot redirect writes outside the project", (t) => {
  const { holder, root } = fixture(t);
  const outside = path.join(holder, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "marker.txt"), "untouched");
  fs.symlinkSync(outside, path.join(root, ".netlify"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareFunctions({ root, env: { CONTEXT: "deploy-preview" } }), /links/);
  assert.deepEqual(fs.readdirSync(outside), ["marker.txt"]);
});

test("source links cannot copy a file from outside the project", (t) => {
  const { holder, root } = fixture(t, { copyFunctions: false });
  const outside = path.join(holder, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "health.js"), "private synthetic fixture");
  // A source parent link points only to synthetic data in this test's holder.
  fs.symlinkSync(outside, path.join(root, "netlify", "functions"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareFunctions({ root, env: { CONTEXT: "deploy-preview" } }), /inside the project/);
  assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
});

test("the CLI builds safely without provider credentials and removes stale chat", (t) => {
  const { root, output } = fixture(t);
  fs.mkdirSync(path.join(root, "scripts"));
  const script = path.join(root, "scripts", "prepare-functions.cjs");
  fs.copyFileSync(path.join(project, "scripts", "prepare-functions.cjs"), script);
  for (const context of ["production", "deploy-preview"]) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root, encoding: "utf8", env: { CONTEXT: context, NETLIFY: "true" },
    });
    assert.equal(result.status, 0, result.stderr);
  }
  assertFiles(output, ["health.js"]);
});

test("the packaged production chat still answers using an offline provider stub", async (t) => {
  const { root, output } = fixture(t);
  prepareFunctions({ root, env: { CONTEXT: "production", NETLIFY: "true" } });
  let calls = 0;
  const context = vm.createContext({
    exports: {}, process: { env: { GEMINI_API_KEY: "synthetic-test-value" } },
    AbortController, setTimeout: () => 1, clearTimeout: () => {},
    console: { log() {}, warn() {}, error() {} },
    fetch: async (_url, options) => {
      calls++;
      assert.equal(options.headers["x-goog-api-key"], "synthetic-test-value");
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }) };
    },
  });
  new vm.Script(fs.readFileSync(path.join(output, "chat.js"), "utf8"))
    .runInContext(context, { timeout: 1000 });
  const response = await context.exports.handler({
    httpMethod: "POST", body: JSON.stringify({ message: "synthetic check", mode: "fast", history: [] }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).reply, "OK");
  assert.equal(calls, 1);
});
