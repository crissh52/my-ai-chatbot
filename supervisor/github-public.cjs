"use strict";

const API = "https://api.github.com/repos/crissh52/my-ai-chatbot";
const REPOSITORY = "crissh52/my-ai-chatbot";
const text = (value, size = 160) => typeof value === "string" ? value.slice(0, size) : "";

function createGithubReader({ fetchImpl = fetch, now = Date.now, ttlMs = 120000 } = {}) {
  let snapshot = null;
  let nextAttemptAt = 0;
  let pending = null;
  let lastError = null;
  let quota = { remaining: null, resetAt: null };

  async function get(suffix) {
    const response = await fetchImpl(API + suffix, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/vnd.github+json", "User-Agent": "AI-Project-Supervisor-Local",
        "X-GitHub-Api-Version": "2022-11-28" },
    });
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    quota = { remaining: remaining !== null && /^\d+$/.test(remaining) ? Number(remaining) : null,
      resetAt: reset !== null && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null };
    if (!response.ok) {
      const code = response.status === 403 || response.status === 429 ? "github_limit_or_denied" : "github_unavailable";
      throw new Error(code);
    }
    const body = await response.text();
    if (body.length > 250000) throw new Error("github_invalid_response");
    try { return JSON.parse(body); } catch { throw new Error("github_invalid_response"); }
  }

  async function collect() {
    try {
      const repository = await get("");
      if (repository.private !== false || repository.full_name !== REPOSITORY) {
        throw new Error("github_invalid_response");
      }
      const main = await get("/branches/main");
      const pull = await get("/pulls/2");
      if (!/^[a-f0-9]{40}$/.test(main.commit?.sha || "") ||
          !/^[a-f0-9]{40}$/.test(pull.head?.sha || "") ||
          typeof main.protected !== "boolean" || typeof pull.draft !== "boolean" ||
          typeof pull.merged !== "boolean" || !["open", "closed"].includes(pull.state)) {
        throw new Error("github_invalid_response");
      }
      const checks = await get(`/commits/${pull.head.sha}/check-runs?per_page=100`);
      if (!Array.isArray(checks.check_runs)) throw new Error("github_invalid_response");
      const health = checks.check_runs.find((check) => check.name === "Health contract tests");
      snapshot = {
        observedAt: new Date(now()).toISOString(), repository: REPOSITORY,
        main: { sha: main.commit.sha, protected: main.protected === true },
        pull: { number: 2, title: text(pull.title), state: text(pull.state, 20),
          draft: pull.draft === true, merged: pull.merged === true,
          sha: pull.head.sha, branch: text(pull.head.ref), base: text(pull.base?.ref),
          changedFiles: Number.isInteger(pull.changed_files) ? pull.changed_files : null },
        check: health ? { name: "Health contract tests", status: text(health.status, 32),
          conclusion: health.conclusion === null ? null : text(health.conclusion, 32) } : null,
        checksTruncated: Number.isInteger(checks.total_count) && checks.total_count > checks.check_runs.length,
        netlify: { status: "not_checked", reason: "No Netlify requests are made by this local module." },
      };
      lastError = null;
    } catch (error) {
      const allowed = ["github_limit_or_denied", "github_unavailable", "github_invalid_response"];
      lastError = allowed.includes(error.message) ? error.message : "github_connection_failed";
    } finally {
      // Apply the cooldown on failures too: repeated clicks cannot hammer GitHub.
      nextAttemptAt = now() + ttlMs;
      if (quota.remaining === 0 && quota.resetAt) {
        nextAttemptAt = Math.max(nextAttemptAt, Date.parse(quota.resetAt));
      }
    }
  }

  async function read() {
    let cached = true;
    if (pending) await pending;
    else if (now() >= nextAttemptAt) {
      cached = false;
      pending = collect();
      try { await pending; } finally { pending = null; }
    }
    return { status: lastError ? snapshot ? "stale" : "unavailable" : "observed",
      cached, snapshot, error: lastError, quota: { ...quota },
      nextCheckAt: new Date(nextAttemptAt).toISOString() };
  }
  return { read };
}

module.exports = { createGithubReader };
