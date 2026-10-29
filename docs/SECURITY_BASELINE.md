# Security baseline — Project Zero / M1

This is a development baseline, not a completed security audit or permission to
onboard other people's websites, servers or tenant data.

## Implemented in this feature branch

- Builds deliberately select Functions by deployment context. Non-production
  builds package Health only; verified production metadata permits the original
  Health/chat handlers. Missing or unsupported metadata stops the build.
- Static publication uses a separate directory containing only the unchanged
  current index.html. Source, scripts, tests and docs are not copied there.
- CI runs the Health and build-isolation tests. Health is public liveness only;
  it does not call an AI provider, require a key or establish overall readiness.
- Releases remain reviewed PRs with owner approval and a hosting-budget check.
  A CI success alone never authorizes a merge or a production deployment.

## Static browser response headers

The netlify.toml /* rule configures:

| Header | Purpose |
| --- | --- |
| X-Content-Type-Options: nosniff | Prevent MIME type guessing |
| X-Frame-Options: DENY | Prevent this page being embedded in a frame |
| Referrer-Policy: no-referrer | Omit referrer information from outgoing requests |
| Permissions-Policy | Disable camera, microphone and geolocation for this page |
| Content-Security-Policy | Block base URL changes, object embeds, framing and cross-origin form submissions |

This CSP deliberately has a limited scope: it does not restrict script/style
execution or claim to prevent XSS. The current self-contained page uses inline
script/style blocks; a future stricter script policy needs its own compatibility
review. Response-header checks are not a substitute for a browser security audit.

Netlify's static header rules do not automatically cover serverless Function
responses. Health returns its own JSON type, no-store and nosniff headers. Future
authenticated APIs need their own appropriate response policy.

## Evidence and boundaries

The 32-test source revision at PR head 795e21c was verified locally and its GitHub
CI succeeded. Official Netlify CLI 27.15.0 / Build 37.7.1 built and bundled the
preview offline; rebuilding after simulated production removed chat from the
Functions manifest. Netlify Dev local HTTP returned page/Health GET 200, Health
POST 405 and chat/source/docs paths 404. The owner also confirmed local behavior.

The static headers added after that revision passed five response-header
assertions in the local Netlify Dev check, alongside the same eight HTTP route
checks; the existing 32 tests also passed. CI for the header commit and actual
hosted Netlify responses still require verification before calling them deployed.
Offline local checks do not establish hosted Linux builds, cloud settings or
behavior of historical deployments. Existing preview URLs are not retroactively
changed by this feature branch. A malicious build can change its own packaging
policy, so production secrets must remain excluded from preview independently.

Do not put secrets in index.html: an intentionally published page is public.
The repository is public too. Publication isolation does not make tracked source
private or remove a secret from Git history.

## Required roadmap work, still incomplete

- Authentication, authorization and durable per-user/workspace project data.
- Per-user secret storage, scoped connectors, revocation and AI data consent.
- Tenant isolation, abuse protection and appropriate request/resource quotas.
- Independent Guardian, notifications, backup lifecycle and tested restoration.
- Self-host installation, privacy/security documentation and public release gates.

Do not substitute this baseline for those features or describe them as removed.
Keep private/customer data out of development fixtures and external AI requests
unless the owner has given the appropriate scoped permission.

## Verification and rollback

Run node --test without real keys. Then build an isolated preview offline and
check both HTTP status and the five static response headers. Verify the unchanged
page bytes and Health contract as well. Check deployed responses only after the
hosting allowance, preview release and owner approval gates are satisfied.

Before merge, production remains unchanged. To withdraw this header increment,
revert its commit on the feature branch, preserving the earlier publication and
Function isolation. Do not weaken branch protection or expose production keys.

References checked 2026-10-29:
- https://docs.netlify.com/manage/routing/headers/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
