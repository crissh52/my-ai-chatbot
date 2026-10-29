# Netlify preview function isolation

This change adds a deployment layer for Project Zero. It does not change the
legacy chat handler, its UI, models or provider credentials.

## Behavior

The Netlify build command runs `scripts/prepare-functions.cjs`. The Functions
directory is `.netlify/supervisor-functions`, generated during that build.

| Build context | Deployed Functions |
| --- | --- |
| Verified Netlify production build | health.js and chat.js, copied unchanged |
| Deploy Preview, branch deploy or dev | health.js only |
| Production metadata with PR or Preview Server flag | health.js only |
| Missing/unknown context or unverified production metadata | Build fails |

After a newly built preview is deployed, its chat Function is absent. A direct
request to `/.netlify/functions/chat` should return 404 without a Gemini call.
The legacy chat UI remains visible in the static page but cannot chat on that
preview. Health remains available for deterministic tests. Production retains
both original handlers.

## Why build-time selection

Netlify documents CONTEXT and NETLIFY as build metadata; CONTEXT is not among
the documented read-only runtime variables for serverless Functions. The policy
uses the build environment rather than assuming process.env.CONTEXT exists in
the running handler. PR and Preview Server metadata additionally block chat.

The build reads only the metadata it needs. It does not read, print or write
GEMINI_API_KEY. Generated output is ignored by Git. Reusing a workspace from
production to preview removes the old generated chat file, avoiding cache reuse.
Unknown generated files abort the build and are preserved for inspection.

## Security boundaries

Keep production secrets out of all preview contexts independently of this layer.
This is defense against accidental AI calls, not a sandbox for hostile code:
a malicious PR could alter its build script. Review code, keep preview keys
isolated, and maintain the hosting provider's sensitive-variable policy.

This affects only new builds that use this configuration. Existing preview URLs,
old deploys, manual uploads or workflows that skip the build are not retroactively
changed. Do not claim they are protected until the relevant deploy is verified.

New Functions must be deliberately added to the packaging policy and tests.
Do not silently copy all Functions into preview builds.

## Verification and rollout

Run `node --test` locally or in GitHub CI. Tests cover context isolation, removal
of stale production artifacts, invalid metadata, credential non-access, safe
filesystem handling, original handler bytes and an offline chat response.

Until regular Netlify credits are available, keep the PR unmerged and include
`[skip netlify]` in its title and in the upload commit message. This skips both
branch and preview builds on Netlify; GitHub tests remain the validation path.
Do not use `[skip ci]`, which can skip GitHub checks.

Local and CI success do not establish Netlify bundling or HTTP behavior. When
budget allows and the owner approves, remove the PR skip marker and push a new
reviewed commit without a skip marker, then deploy a new preview. Confirm Health
GET 200/POST 405 and chat 404, then review the production build before release.
Do not send real provider requests from preview for this verification.

## Rollback

Before merge, leave or close the PR; production is unchanged. After an approved
release, revert the packaging/configuration change through a reviewed PR and use
the recorded known-good production deploy if recovery is needed. Restoring the
old packaging also restores the old preview chat exposure, so preserve context
isolation and the release budget checks throughout recovery.

References checked 2026-10-28:

- https://docs.netlify.com/build/configure-builds/environment-variables/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy
