"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, scrypt, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);
const COOKIE = "supervisor_local_session";
function createLocalAuth({ root = path.resolve(__dirname, ".."), now = Date.now, sessionMs = 8 * 60 * 60 * 1000 } = {}) {
  const rootPath = fs.realpathSync(root);
  const file = path.join(rootPath, ".netlify", "supervisor-auth", "auth.json");
  const sessions = new Map();
  let busy = false; let failures = 0; let blockedUntil = 0;
  function directory(create) {
    let dir = rootPath;
    for (const part of [".netlify", "supervisor-auth"]) {
      dir = path.join(dir, part); let stat;
      try { stat = fs.lstatSync(dir); }
      catch (error) { if (error.code !== "ENOENT") throw error; if (!create) return false; fs.mkdirSync(dir); stat = fs.lstatSync(dir); }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("auth_unavailable");
    }
    return true;
  }
  function config() {
    if (!directory(false)) return null;
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error("auth_unavailable");
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || Object.keys(value).length !== 4 || value.schemaVersion !== 1 || value.kdf !== "scrypt-N32768-r8-p3" ||
        !/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{64}$/.test(value.hash)) throw new Error("auth_unavailable");
    return value;
  }
  function validPassword(password) {
    return typeof password === "string" && [...password].length >= 15 && [...password].length <= 128 && Buffer.byteLength(password) <= 512;
  }
  const hash = (password, salt) => derive(password, Buffer.from(salt, "hex"), 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  function key(cookie) {
    const matches = String(cookie || "").split(";").map((v) => v.trim()).filter((v) => v.startsWith(COOKIE + "="));
    if (matches.length !== 1) return null;
    const token = matches[0].slice(COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? createHash("sha256").update(token).digest("hex") : null;
  }
  function authenticated(cookie) {
    // A missing/broken account file invalidates access, including existing sessions.
    if (!config()) return false;
    const id = key(cookie); const expires = sessions.get(id);
    if (!expires || expires <= now()) { if (id) sessions.delete(id); return false; }
    return true;
  }
  function issue() {
    const token = randomBytes(32).toString("hex");
    // Single personal session. A new login revokes earlier sessions.
    sessions.clear(); sessions.set(createHash("sha256").update(token).digest("hex"), now() + sessionMs);
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionMs / 1000)}`;
  }
  async function enter(action, password) {
    if (!validPassword(password)) throw new Error("auth_password_invalid");
    if (busy || now() < blockedUntil) throw new Error("auth_try_later");
    busy = true;
    try {
      const existing = config();
      if (action === "setup") {
        if (existing) throw new Error("auth_already_configured");
        const salt = randomBytes(16).toString("hex");
        const value = { schemaVersion: 1, kdf: "scrypt-N32768-r8-p3", salt, hash: (await hash(password, salt)).toString("hex") };
        directory(true);
        // Never overwrite another setup or an existing credential file.
        fs.writeFileSync(file, JSON.stringify(value), { flag: "wx", mode: 0o600 });
      } else {
        if (!existing) throw new Error("auth_setup_required");
        const candidate = await hash(password, existing.salt);
        if (!timingSafeEqual(candidate, Buffer.from(existing.hash, "hex"))) {
          failures++;
          if (failures >= 5) { blockedUntil = now() + 15 * 60 * 1000; failures = 0; }
          throw new Error("auth_invalid_login");
        }
      }
      failures = 0; return issue();
    } finally { busy = false; }
  }
  function logout(cookie) { const id = key(cookie); if (id) sessions.delete(id); return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`; }
  return { configured: () => Boolean(config()), authenticated, enter, logout };
}
module.exports = { createLocalAuth };
