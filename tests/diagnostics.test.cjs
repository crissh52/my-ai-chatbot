"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { diagnose } = require("../supervisor/diagnostics.cjs");
function evidence() {
  return { status: "observed", snapshot: { observedAt: "2026-10-29T00:00:00.000Z",
    main: { protected: true }, pull: { number: 2, draft: true, merged: false, state: "open" },
    check: { status: "completed", conclusion: "success" }, checksTruncated: false } };
}
const has = (analysis, id) => analysis.findings.some((f) => f.id === id);
test("passing CI never implies deployment verified or an action executed", () => {
  const result = diagnose(evidence());
  assert.ok(has(result, "ci_pass")); assert.ok(has(result, "deployment_unverified"));
  assert.equal(result.actionsExecuted, false);
  assert.ok(result.findings.every((f) => f.autoExecuted === false));
});
test("stale successful CI is not presented as current success", () => {
  const input = evidence(); input.status = "stale";
  const result = diagnose(input);
  assert.equal(result.findings.length, 1); assert.ok(has(result, "fresh_evidence_required"));
  assert.equal(result.observedAt, input.snapshot.observedAt); assert.equal(has(result, "ci_pass"), false);
});
test("no upstream evidence produces no fabricated facts", () => {
  const result = diagnose({ status: "unavailable", snapshot: null });
  assert.equal(result.observedAt, null); assert.equal(has(result, "main_protected"), false);
  assert.ok(has(result, "fresh_evidence_required"));
});
test("unprotected main is flagged without proposing automatic changes", () => {
  const input = evidence(); input.snapshot.main.protected = false;
  assert.ok(has(diagnose(input), "main_unprotected"));
});
test("missing CI is unknown rather than successful", () => {
  const input = evidence(); input.snapshot.check = null;
  assert.ok(has(diagnose(input), "ci_unknown"));
});
test("running check is distinct from successful completion", () => {
  const input = evidence(); input.snapshot.check.status = "in_progress";
  const result = diagnose(input); assert.ok(has(result, "ci_pending")); assert.equal(has(result, "ci_pass"), false);
});
test("failure or cancellation requests inspection instead of release", () => {
  for (const conclusion of ["failure", "cancelled", "timed_out", null]) {
    const input = evidence(); input.snapshot.check.conclusion = conclusion;
    assert.ok(has(diagnose(input), "ci_attention"));
  }
});
test("merged pull does not establish deployed state", () => {
  const input = evidence(); input.snapshot.pull.merged = true;
  const result = diagnose(input); assert.ok(has(result, "pull_merged")); assert.ok(has(result, "deployment_unverified"));
});
test("closed unmerged pull is not described as pending approval", () => {
  const input = evidence(); input.snapshot.pull.state = "closed";
  const result = diagnose(input); assert.ok(has(result, "pull_closed")); assert.equal(has(result, "pull_pending"), false);
});
test("truncated check list is an explicit limit and input is not modified", () => {
  const input = evidence(); input.snapshot.checksTruncated = true;
  const before = JSON.stringify(input);
  assert.ok(has(diagnose(input), "checks_incomplete")); assert.equal(JSON.stringify(input), before);
});
