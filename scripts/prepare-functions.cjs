"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FUNCTION_NAMES = ["health.js", "chat.js"];
const OUTPUT_PARTS = [".netlify", "supervisor-functions"];
const CONTEXTS = new Set(["production", "deploy-preview", "branch-deploy", "dev"]);

function selectFunctions(env) {
  if (!CONTEXTS.has(env.CONTEXT)) {
    throw new Error("A supported Netlify CONTEXT is required; no deploy prepared.");
  }

  if (env.CONTEXT !== "production") return ["health.js"];
  if (env.NETLIFY !== "true") {
    throw new Error("Production packaging requires the Netlify build environment.");
  }

  // Preview Server and PR metadata must never enable the legacy AI endpoint.
  const previewServer = env.NETLIFY_PREVIEW_SERVER && env.NETLIFY_PREVIEW_SERVER !== "false";
  const pullRequest = env.PULL_REQUEST && env.PULL_REQUEST !== "false";
  return previewServer || pullRequest ? ["health.js"] : [...FUNCTION_NAMES];
}

function prepareFunctions({ root = path.resolve(__dirname, ".."), env = process.env } = {}) {
  const names = selectFunctions(env);
  const rootPath = fs.realpathSync(root);
  const sources = names.map((name) => {
    const source = path.join(rootPath, "netlify", "functions", name);
    const relative = path.relative(rootPath, fs.realpathSync(source));
    if (relative.startsWith("..") || path.isAbsolute(relative) ||
        !fs.lstatSync(source).isFile()) {
      throw new Error("Function source must be a regular file inside the project.");
    }
    return { name, source };
  });

  let output = rootPath;
  for (const part of OUTPUT_PARTS) {
    output = path.join(output, part);
    if (!fs.existsSync(output)) fs.mkdirSync(output);
    const stat = fs.lstatSync(output);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Generated function directories must not be links or files.");
    }
  }

  const previous = fs.readdirSync(output, { withFileTypes: true });
  if (previous.some((entry) => !FUNCTION_NAMES.includes(entry.name) || !entry.isFile())) {
    throw new Error("Unexpected generated entry; nothing was removed. Inspect the build directory.");
  }

  // Remove only our two known generated files, including a stale production chat
  // artifact when the same workspace is subsequently used for a preview build.
  for (const entry of previous) fs.unlinkSync(path.join(output, entry.name));
  for (const { name, source } of sources) fs.copyFileSync(source, path.join(output, name));

  return { context: env.CONTEXT, functions: names };
}

module.exports = { selectFunctions, prepareFunctions };

if (require.main === module) {
  try {
    const result = prepareFunctions();
    console.log(`Prepared Functions: ${result.functions.join(", ")}`);
  } catch (error) {
    // Do not print environment values, provider keys or whole process objects.
    console.error(`Function packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}
