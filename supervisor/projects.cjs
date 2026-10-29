"use strict";
const fs = require("node:fs"); const path = require("node:path"); const { randomUUID } = require("node:crypto");
const ZERO = "crissh52/my-ai-chatbot";
const validRepo = (value) => value === "" || typeof value === "string" && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/.test(value) && ![".", ".."].includes(value.split("/")[1]);
const validName = (value) => typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 80 && !/[\x00-\x1f\x7f]/.test(value);
function createProjectStore({ root = path.resolve(__dirname, ".."), now = () => new Date().toISOString() } = {}) {
  const rootPath = fs.realpathSync(root); const file = path.join(rootPath, ".netlify", "supervisor-projects", "projects.json");
  function directory(create) {
    let dir = rootPath;
    for (const part of [".netlify", "supervisor-projects"]) {
      dir = path.join(dir, part); let stat;
      try { stat = fs.lstatSync(dir); }
      catch (error) { if (error.code !== "ENOENT") throw error; if (!create) return false; fs.mkdirSync(dir); stat = fs.lstatSync(dir); }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("projects_unavailable");
    }
    return true;
  }
  function valid(item) {
    return item && Object.keys(item).length === 6 && ["id", "name", "repository", "archived", "createdAt", "updatedAt"].every((key) => Object.hasOwn(item, key)) &&
      /^[a-f0-9-]{36}$/.test(item.id) && validName(item.name) && validRepo(item.repository) && item.repository === item.repository.toLowerCase() &&
      typeof item.archived === "boolean" && [item.createdAt, item.updatedAt].every((v) => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v) && item.updatedAt >= item.createdAt;
  }
  function readCustom() {
    if (!directory(false)) return [];
    let stat; try { stat = fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1000000) throw new Error("projects_unavailable");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Object.keys(data).length !== 2 || data.schemaVersion !== 1 || !Array.isArray(data.projects) || data.projects.length > 19 || !data.projects.every(valid) ||
        new Set(data.projects.map((p) => p.id)).size !== data.projects.length ||
        new Set([ZERO, ...data.projects.map((p) => p.repository).filter(Boolean)]).size !== data.projects.filter((p) => p.repository).length + 1) throw new Error("projects_unavailable");
    return data.projects;
  }
  function view(items) {
    return [{ id: "project-zero", name: "AI Project Supervisor", repository: ZERO, archived: false, builtin: true, connection: "project_zero_only" },
      ...items.map((p) => ({ ...p, builtin: false, connection: "not_connected" }))];
  }
  function write(items) {
    directory(true); const temp = path.join(path.dirname(file), `projects-${randomUUID()}.tmp`);
    try { fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, projects: items }, null, 2), { flag: "wx", mode: 0o600 }); fs.renameSync(temp, file); }
    finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    return view(items);
  }
  function create(name, repository) {
    const cleanedName = typeof name === "string" ? name.trim() : name;
    const cleanedRepo = typeof repository === "string" ? repository.trim().toLowerCase() : repository;
    if (!validName(cleanedName) || !validRepo(cleanedRepo)) throw new Error("projects_invalid_input");
    const items = readCustom();
    if (cleanedRepo && [ZERO, ...items.map((p) => p.repository)].includes(cleanedRepo)) throw new Error("projects_duplicate");
    if (items.length >= 19) throw new Error("projects_limit");
    const stamp = now(); const item = { id: randomUUID(), name: cleanedName, repository: cleanedRepo, archived: false, createdAt: stamp, updatedAt: stamp };
    if (!valid(item)) throw new Error("projects_unavailable"); return write([item, ...items]);
  }
  function archive(id, archived) {
    if (id === "project-zero") throw new Error("projects_zero_fixed");
    if (typeof archived !== "boolean") throw new Error("projects_invalid_input");
    const items = readCustom(); const item = items.find((p) => p.id === id); if (!item) throw new Error("projects_not_found");
    item.archived = archived; item.updatedAt = now(); if (!valid(item)) throw new Error("projects_unavailable"); return write(items);
  }
  return { read: () => view(readCustom()), create, archive };
}
module.exports = { createProjectStore };
