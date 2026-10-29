"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const FIELDS = ["observedAt", "mainSha", "mainProtected", "pullSha", "pullState", "draft", "merged", "ciStatus", "ciConclusion"];

function createHistoryStore({ root = path.resolve(__dirname, ".."), limit = 50 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("history_invalid_limit");
  const rootPath = fs.realpathSync(root);
  const file = path.join(rootPath, ".netlify", "supervisor-history", "history.json");
  function directory(create) {
    let dir = rootPath;
    for (const part of [".netlify", "supervisor-history"]) {
      dir = path.join(dir, part);
      if (!fs.existsSync(dir)) { if (!create) return false; fs.mkdirSync(dir); }
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("history_unsafe_path");
    }
    return true;
  }
  function valid(item) {
    return item && Object.keys(item).length === FIELDS.length && FIELDS.every((key) => Object.hasOwn(item, key)) &&
      typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt)) &&
      new Date(item.observedAt).toISOString() === item.observedAt &&
      /^[a-f0-9]{40}$/.test(item.mainSha) && /^[a-f0-9]{40}$/.test(item.pullSha) &&
      typeof item.mainProtected === "boolean" && typeof item.draft === "boolean" && typeof item.merged === "boolean" &&
      ["open", "closed"].includes(item.pullState) &&
      [item.ciStatus, item.ciConclusion].every((v) => v === null || typeof v === "string" && v.length <= 32);
  }
  function load() {
    if (!directory(false)) return [];
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1000000) throw new Error("history_invalid_file");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Object.keys(data).length !== 3 || data.schemaVersion !== 1 || data.repository !== "crissh52/my-ai-chatbot" ||
        !Array.isArray(data.items) || data.items.length > 50 || !data.items.every(valid) ||
        data.items.some((item, i) => i && item.observedAt >= data.items[i - 1].observedAt)) {
      throw new Error("history_invalid_file");
    }
    return data.items.slice(0, limit);
  }
  function view(items) {
    const changes = items.length < 2 ? [] : FIELDS.filter((key) => key !== "observedAt" && items[0][key] !== items[1][key])
      .map((field) => ({ field, before: items[1][field], after: items[0][field] }));
    return { status: "available", items, changes, comparisonAvailable: items.length >= 2, retention: limit };
  }
  function read() { return view(load()); }
  function record(result) {
    const items = load();
    if (result?.status !== "observed" || !result.snapshot) return view(items);
    const s = result.snapshot;
    if (s.repository !== "crissh52/my-ai-chatbot") throw new Error("history_wrong_project");
    const item = { observedAt: s.observedAt, mainSha: s.main.sha, mainProtected: s.main.protected,
      pullSha: s.pull.sha, pullState: s.pull.state, draft: s.pull.draft, merged: s.pull.merged,
      ciStatus: s.check?.status ?? null, ciConclusion: s.check?.conclusion ?? null };
    if (!valid(item)) throw new Error("history_invalid_observation");
    // Cached/older observations cannot create duplicates or replace newer evidence.
    if (items[0] && item.observedAt <= items[0].observedAt) return view(items);
    const next = [item, ...items].slice(0, limit);
    directory(true);
    const temp = path.join(path.dirname(file), `history-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, repository: "crissh52/my-ai-chatbot", items: next }, null, 2),
        { flag: "wx", mode: 0o600 });
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    return view(next);
  }
  return { read, record };
}
module.exports = { createHistoryStore };
