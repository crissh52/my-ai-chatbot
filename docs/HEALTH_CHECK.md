# Health Check — M1

`netlify/functions/health.js` is a public liveness endpoint. It checks whether
the function can answer a request. It does not check Gemini, databases,
authentication, tenant isolation, backups or overall system readiness.

## Local verification

With a supported Node.js version that provides the built-in test runner:

```sh
node --test tests/health.test.cjs
```

No package installation, API key or external network request is required.
The seven tests check GET and rejection of POST, PUT, PATCH, DELETE, OPTIONS
and HEAD at the handler boundary. A deployed HTTP server may suppress a HEAD
response body, so its body is not part of the deployment smoke test.

## Deploy Preview smoke test

First verify that non-production contexts do not receive production secrets.
Use a newly created Deploy Preview after saving the environment configuration.
Copy its exact HTTPS URL from Netlify; do not guess a preview number.

1. Open `<preview-origin>/.netlify/functions/health` in a browser.
2. Confirm HTTP 200 with JSON containing `status: "ok"`,
   `service: "supervisor-core"` and a current ISO `checkedAt` timestamp.
3. From that preview origin, send POST to the same endpoint with no body,
   credentials or private data. Confirm HTTP 405, `Allow: GET` and
   `{"error":"method_not_allowed"}`.
4. For both requests, check `Content-Type: application/json; charset=utf-8`,
   `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
5. Record the tested commit, deploy ID/URL, time and actual outcomes.

Do not send a chat message or call the chat endpoint during this check.
A non-empty dummy key does not prevent the legacy chat handler from trying
to contact its AI provider. Local tests are not evidence that Netlify deployed
the endpoint successfully.

## Rollback

Keep the PR unmerged while testing. Stop testing and close the PR if necessary;
closing it does not guarantee existing preview URLs are removed. Inspect
Netlify separately if a preview must be removed. No production rollback is
required for changes confined to an unmerged feature branch and its preview.
Do not delete the feature branch or the legacy backup as part of this check.
