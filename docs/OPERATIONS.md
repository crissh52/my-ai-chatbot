# Project Supervisor operations — foundation

Status: foundation / private alpha. This runbook documents verified operations,
not completed authentication, tenant isolation, Guardian or backup restoration.

## Development and release flow

1. Develop on a feature branch, preserving the legacy backup branch.
2. Run `node --test` locally. No API key is needed.
3. Open a PR into main. The Health contract tests check must pass.
4. Review the diff and confirm that changes stay within the approved scope.
5. Before merging, check the hosting plan, regular credits, reset date and
   expected release usage. Do not treat operational credits as deploy credits.
6. Obtain owner approval for production release. Main can auto-publish on merge.
7. After Published, verify the actual commit/deploy and test production outcomes.

When production deployment is paused or budget is insufficient, keep changes
on feature branches. Continue local testing and CI; avoid merging changes that
cannot be released and verified. Do not upgrade, enable automatic purchases or
create accounts/teams to evade quotas.

For a CI-only PR while hosting credits are exhausted, put `[skip netlify]` in the
PR title and upload commit message. Preserve GitHub CI by not using `[skip ci]`.
Keep that PR unmerged until the hosting release budget and required deployment
verification are available. Before an approved release, remove the title marker
and add a reviewed commit without a skip marker so Netlify can build normally.

## Budget: zero paid expenditure

- Use legitimate free allowances and remain within their terms.
- Do not enable billing, buy credits, upgrade plans or enroll in paid trials
  without explicit owner approval overriding the zero-cost constraint.
- Group changes into tested releases instead of repeated production deploys.
- Prefer deterministic checks before AI inference. Use small, synthetic input
  for smoke tests, without chat history or private data.
- Check the current provider documentation before adopting a service or model.
- Free hosting has limits; public users need transparent quotas and BYOK or
  self-host options, without promises of unlimited subsidized computing.

Reference checked 2026-10-28: Netlify credit-based plans charge 15 credits per
successful production deploy. Deploy Preview/branch deployment itself uses zero
deployment credits, while requests, bandwidth and runtime compute can still
consume credits. Recheck these terms before future releases:
https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/

## Health verification

`GET /.netlify/functions/health` should return 200, public JSON with status `ok`,
service `supervisor-core` and an ISO checkedAt timestamp. POST should return 405,
Allow GET and error `method_not_allowed`. Both responses use JSON UTF-8,
Cache-Control no-store and X-Content-Type-Options nosniff.

Health is liveness only. It does not establish AI availability, authentication,
tenant isolation, data integrity, backup recovery or overall readiness.
See HEALTH_CHECK.md for detailed tests.

## Credential rotation

Only the owner handles credential values. Never put them into chat, source,
screenshots, logs or public reports.

1. Identify the exact credential and every authorized application using it.
2. Create a replacement in the approved provider project without enabling paid
   services or broadening permissions.
3. Update only the authorized environment context, preserving preview isolation.
4. Create a new deploy so runtime receives the updated environment.
5. Verify with one harmless request.
6. Revoke the old credential after checking dependencies; verify again.

Rotation of a suspected exposed credential takes priority over convenience.
If active misuse is detected, reassess the order and availability tradeoff with
the owner. Do not depend on restoring a deleted credential.

## Recovery

Record a known-good deploy ID and commit before release. For credential changes,
the recovery deploy must use a valid credential, not a revoked one.

Netlify can republish an available previous successful deploy. Check current
rollback terms and auto-publishing behavior before acting. Restore the Git
state through a reviewed revert when needed; do not rewrite shared history or
delete the legacy backup. Record approval, action and verification.

A source ZIP or Git backup is not evidence of database/secret backup restoration.
Guardian and restoration drills remain separate roadmap work.
