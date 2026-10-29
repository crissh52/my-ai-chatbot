"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const STATUSES = ["todo", "doing", "done"];
function createTaskStore({ root = path.resolve(__dirname, ".."), now = () => new Date().toISOString() } = {}) {
  const rootPath = fs.realpathSync(root);
  const file = path.join(rootPath, ".netlify", "supervisor-tasks", "tasks.json");
  function directory(create) {
    let dir = rootPath;
    for (const part of [".netlify", "supervisor-tasks"]) {
      dir = path.join(dir, part);
      let stat;
      try { stat = fs.lstatSync(dir); }
      catch (error) { if (error.code !== "ENOENT") throw error; if (!create) return false; fs.mkdirSync(dir); stat = fs.lstatSync(dir); }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("tasks_unavailable");
    }
    return true;
  }
  function valid(task) {
    return task && Object.keys(task).length === 5 && ["id", "title", "status", "createdAt", "updatedAt"].every((key) => Object.hasOwn(task, key)) &&
      /^[a-f0-9-]{36}$/.test(task.id) && typeof task.title === "string" && task.title.trim() === task.title &&
      task.title.length > 0 && task.title.length <= 160 && !/[\x00-\x1f\x7f]/.test(task.title) && STATUSES.includes(task.status) &&
      [task.createdAt, task.updatedAt].every((v) => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v) &&
      task.updatedAt >= task.createdAt;
  }
  function read() {
    if (!directory(false)) return [];
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1000000) throw new Error("tasks_unavailable");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Object.keys(data).length !== 2 || data.schemaVersion !== 1 || !Array.isArray(data.tasks) ||
        data.tasks.length > 100 || !data.tasks.every(valid) || new Set(data.tasks.map((task) => task.id)).size !== data.tasks.length) {
      throw new Error("tasks_unavailable");
    }
    return data.tasks;
  }
  function write(tasks) {
    directory(true);
    const temp = path.join(path.dirname(file), `tasks-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, tasks }, null, 2), { flag: "wx", mode: 0o600 });
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    return tasks;
  }
  function create(title) {
    if (typeof title !== "string" || !title.trim() || title.trim().length > 160 || /[\x00-\x1f\x7f]/.test(title)) throw new Error("tasks_invalid_title");
    const tasks = read();
    if (tasks.length >= 100) throw new Error("tasks_limit");
    const timestamp = now();
    const task = { id: randomUUID(), title: title.trim(), status: "todo", createdAt: timestamp, updatedAt: timestamp };
    if (!valid(task)) throw new Error("tasks_unavailable");
    return write([task, ...tasks]);
  }
  function update(id, status) {
    if (!STATUSES.includes(status)) throw new Error("tasks_invalid_status");
    const tasks = read(); const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("tasks_not_found");
    task.status = status; task.updatedAt = now();
    if (!valid(task)) throw new Error("tasks_unavailable");
    return write(tasks);
  }
  return { read, create, update };
}
module.exports = { createTaskStore };
