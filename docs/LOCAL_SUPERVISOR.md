# Project Zero local evidence dashboard — M2 preparation

This is a separate local prototype built on the M1 feature branch. It is not a
hosted release or a claim that M1's cloud verification / all M2 work is complete.
Keep PR #2 unchanged. Review this increment on feature/project-zero-local with
base feature/preview-ai-isolation until the foundation can be released safely.

## Start and use

On this Windows workstation with Node installed, double-click START_SUPERVISOR.cmd
or run node scripts/start-supervisor.cjs from the repository root. Open
http://127.0.0.1:8892. Click the GitHub check button to collect public evidence.
Stop with Ctrl+C. No npm install, API key, Netlify login or AI provider is needed.
With LOCAL_AUTH, first create the owner's password on the local page; later
starts require login. Task/history data are retained while sessions reset.

The page displays the actual main commit/protection, PR #2 state/commit and its
Health contract tests check. Netlify always stays not_checked because this module
never requests Netlify. Main commit and CI success do not establish deployed state.
Unknown, running, failing, unavailable and stale observations remain distinct.

## Resource and privacy boundaries

- Four anonymous HTTPS GET requests, only to fixed paths of the owner's public
  crissh52/my-ai-chatbot repository; no arbitrary URLs, tokens or credential reads.
- No startup/background polling. Concurrent clicks share an in-flight read and
  successful/failed attempts cool down for two minutes. Rate exhaustion waits
  until the reported reset where available; no account/key fallback.
- Data is minimized to status fields and held in process memory. Stop/restart
  clears it; project/task persistence is still required roadmap work.
- Server binds only 127.0.0.1 and rejects foreign Host/Origin and cross-site
  requests. These restrictions are not a replacement for user authentication.
- Only three static asset routes and one GET API; no write, merge, deploy, AI,
  filesystem browsing or private-repository connector.
- External links are fixed. Remote titles render as text, under a self-only
  script/style CSP. Do not put secrets in UI, test fixtures or the public repo.

GitHub anonymous allowance is shared by IP; the application displays reported
remaining/reset information. A limit error is an expected recoverable condition,
not a reason to create another account or buy service.

## Tests and release boundaries

Run node --test. Connector tests use synthetic upstream fixtures. HTTP tests
exercise the local server, origin checks, methods and path isolation. A local
real-data smoke check should verify the fixed repo/commits and cache behavior;
failure must display unknown/stale rather than fabricated success.

The existing Netlify public-output allowlist remains unchanged and does not
publish this dashboard. Do not add a serverless dashboard endpoint or expose this
local server publicly before authentication, authorization, persistence, consent,
quotas and relevant security gates are implemented and tested.

The prototype tracks one explicit Project Zero entry. It is not a completed
editable project registry, multi-tenant platform, Guardian or production monitor.

## Review and rollback

Use [skip netlify] in the commit and PR title. Open a Draft PR with base
feature/preview-ai-isolation and compare feature/project-zero-local. The workflow
also accepts that base branch, preserving the Health contract tests check name.
Keep both PRs unmerged until their release gates and owner approval are satisfied.
When the foundation reaches main, retarget this PR to main and rerun checks.

Before merge, stop the local server and leave/close this PR to withdraw it.
The legacy page, Functions, production settings, credentials and PR #2 need no
rollback because this module does not change them.

Reference checked 2026-10-29:
https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
