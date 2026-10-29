"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { prepareSite } = require("../scripts/prepare-site.cjs");
const project = path.resolve(__dirname, "..");

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const holder = fs.mkdtempSync(path.join(parent, "supervisor-site-"));
  const root = path.join(holder, "project");
  fs.mkdirSync(path.join(root, "netlify", "functions"), { recursive: true });
  for (const name of ["health.js", "chat.js"]) {
    fs.copyFileSync(path.join(project, "netlify", "functions", name),
      path.join(root, "netlify", "functions", name));
  }
  fs.copyFileSync(path.join(project, "index.html"), path.join(root, "index.html"));
  t.after(() => {
    const target = fs.realpathSync(holder);
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith("supervisor-site-"));
    assert.equal(fs.lstatSync(holder).isSymbolicLink(), false);
    fs.rmSync(target, { recursive: true, force: true });
  });
  return { holder, root, output: path.join(root, ".netlify", "supervisor-public") };
}

const production = { CONTEXT: "production", NETLIFY: "true" };

test("site production build preserves the page and both handler bytes", (t) => {
  const { root, output } = fixture(t);
  prepareSite({ root, env: production });
  assert.deepEqual(fs.readdirSync(output), ["index.html"]);
  assert.deepEqual(fs.readFileSync(path.join(output, "index.html")),
    fs.readFileSync(path.join(project, "index.html")));
  for (const name of ["health.js", "chat.js"]) {
    assert.deepEqual(fs.readFileSync(path.join(root, ".netlify", "supervisor-functions", name)),
      fs.readFileSync(path.join(project, "netlify", "functions", name)));
  }
});

for (const context of ["deploy-preview", "branch-deploy", "dev"]) {
  test(`site ${context} rebuild retains the page and removes cached AI Function`, (t) => {
    const { root, output } = fixture(t);
    prepareSite({ root, env: production });
    prepareSite({ root, env: { CONTEXT: context } });
    assert.deepEqual(fs.readdirSync(output), ["index.html"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".netlify", "supervisor-functions")), ["health.js"]);
  });
}

test("private-looking synthetic files, scripts and handlers stay outside public output", (t) => {
  const { root, output } = fixture(t);
  fs.writeFileSync(path.join(root, ".env"), "SYNTHETIC=not-a-real-secret");
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "private-note.md"), "synthetic private note");
  const env = { ...production };
  Object.defineProperty(env, "GEMINI_API_KEY", { get() { throw new Error("Do not read keys"); } });
  prepareSite({ root, env });
  assert.deepEqual(fs.readdirSync(output), ["index.html"]);
  assert.equal(fs.readFileSync(path.join(output, "index.html"), "utf8").includes("synthetic private note"), false);
});

test("a missing page stops the site build before generated output", (t) => {
  const { root } = fixture(t);
  fs.unlinkSync(path.join(root, "index.html"));
  assert.throws(() => prepareSite({ root, env: production }));
  assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
});

test("public output links cannot redirect page writes", (t) => {
  const { holder, root } = fixture(t);
  const outside = path.join(holder, "outside");
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(root, ".netlify"));
  fs.symlinkSync(outside, path.join(root, ".netlify", "supervisor-public"),
    process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareSite({ root, env: production }), /link/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("unexpected cached public files stop the build and are preserved", (t) => {
  const { root, output } = fixture(t);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, ".env"), "synthetic marker");
  assert.throws(() => prepareSite({ root, env: production }), /Unexpected/);
  assert.equal(fs.readFileSync(path.join(output, ".env"), "utf8"), "synthetic marker");
  assert.equal(fs.existsSync(path.join(output, "index.html")), false);
});

test("a page path redirected to an external directory cannot be published", (t) => {
  const { holder, root } = fixture(t);
  const outside = path.join(holder, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "index.html"), "synthetic private page");
  fs.unlinkSync(path.join(root, "index.html"));
  fs.symlinkSync(outside, path.join(root, "index.html"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareSite({ root, env: production }), /regular file/);
  assert.equal(fs.existsSync(path.join(root, ".netlify")), false);
  assert.deepEqual(fs.readdirSync(outside), ["index.html"]);
});

test("configured site CLI builds production then preview without credentials", (t) => {
  const { root, output } = fixture(t);
  fs.mkdirSync(path.join(root, "scripts"));
  for (const name of ["prepare-site.cjs", "prepare-functions.cjs"]) {
    fs.copyFileSync(path.join(project, "scripts", name), path.join(root, "scripts", name));
  }
  const config = fs.readFileSync(path.join(project, "netlify.toml"), "utf8");
  assert.match(config, /command = "node scripts\/prepare-site\.cjs"/);
  assert.match(config, /publish = "\.netlify\/supervisor-public"/);
  assert.match(config, /directory = "\.netlify\/supervisor-functions"/);
  for (const context of ["production", "deploy-preview"]) {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "prepare-site.cjs")], {
      cwd: root, encoding: "utf8", env: { CONTEXT: context, NETLIFY: "true" },
    });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.deepEqual(fs.readdirSync(output), ["index.html"]);
  assert.deepEqual(fs.readdirSync(path.join(root, ".netlify", "supervisor-functions")), ["health.js"]);
});
