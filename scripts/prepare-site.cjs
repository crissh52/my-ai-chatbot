"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { prepareFunctions } = require("./prepare-functions.cjs");

function prepareSite({ root = path.resolve(__dirname, ".."), env = process.env } = {}) {
  const rootPath = fs.realpathSync(root);
  const source = path.join(rootPath, "index.html");
  const relative = path.relative(rootPath, fs.realpathSync(source));
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.lstatSync(source).isFile()) {
    throw new Error("The page must be a regular file inside the project.");
  }

  // This also validates the shared .netlify parent before any public file write.
  const functions = prepareFunctions({ root: rootPath, env });
  const output = path.join(rootPath, ".netlify", "supervisor-public");
  if (!fs.existsSync(output)) fs.mkdirSync(output);
  const stat = fs.lstatSync(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("The public directory must not be a link or file.");
  }
  const previous = fs.readdirSync(output, { withFileTypes: true });
  if (previous.some((entry) => entry.name !== "index.html" || !entry.isFile())) {
    throw new Error("Unexpected public entry; nothing was removed. Inspect the build directory.");
  }

  // Explicit allowlist: never copy the repository, environment, docs or handlers.
  fs.copyFileSync(source, path.join(output, "index.html"));
  return { ...functions, publicFiles: ["index.html"] };
}

module.exports = { prepareSite };

if (require.main === module) {
  try {
    const result = prepareSite();
    console.log(`Prepared public files: ${result.publicFiles.join(", ")}`);
    console.log(`Prepared Functions: ${result.functions.join(", ")}`);
  } catch {
    // Filesystem errors may include paths: expose no environment values or paths.
    console.error("Site packaging failed. Check build metadata and the allowed source/output files.");
    process.exitCode = 1;
  }
}
