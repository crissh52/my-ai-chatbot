# Personal local authentication

This increment gates /api/project-zero, /api/history and /api/tasks server-side.
Before authentication they return401 without reading protected data or calling
GitHub. Static assets and /api/auth expose only the login shell/session status.
There is no environment flag, query parameter or HTTP bypass for protected APIs.
Tests inject explicit in-process auth doubles for unrelated route tests; the new
auth suite uses real account/session implementations and HTTP guards.

## Owner setup

Restart the local server, open http://127.0.0.1:8892 and create a unique15–128
character password directly in the two local fields. Do not send it, screenshots
of it or the auth file to chat/GitHub/AI. Keep it in your password manager.
No email, Google login, API key, hosted auth service or payment is required.

Password storage uses a random salt and Node scrypt N32768/r8/p3,32-byte output;
no plaintext password is stored or logged. Configuration is under
.netlify/supervisor-auth/auth.json, ignored by Git and outside static output.
Setup uses exclusive create and refuses overwrite. Invalid existing config fails
closed, rather than offering silent reset. No password-reset bypass is provided.
Recovery/password change is separate work; preserve the auth file and user data.

## Sessions and boundaries

Random32-byte session tokens are held server-side only as SHA256 keys. Cookie is
HttpOnly, SameSite=Strict, Path=/,8-hour maximum lifetime. New login revokes the
prior session. Logout and server restart invalidate sessions. Account config,
task data and history persist. Failed logins are bounded:5wrong attempts trigger
a15-minute cooldown; only one expensive hash operation runs at a time.
These limits are process-local and reset on restart, not distributed anti-abuse.

Origin/Host, anti-CSRF token, JSON type and bounded body checks cover setup,
login/logout and task writes. Passwords stay out of API responses/reports.
Local cookies deliberately lack Secure on HTTP127.0.0.1. Do not expose this server
via LAN, tunnel or public proxy. Hosted deployment requires HTTPS/Secure cookies,
production-grade session/secret persistence, recovery and broader access testing.
This feature does not protect against a malicious local OS user or implement
multi-tenancy, MFA, OAuth, connector token storage or encryption of task/history.

After login, current status still requires a manual GitHub check. Session expiry
causes the UI to return to login when an API request receives401. Auth failures
hide the workspace; explicit logout reloads the page to clear displayed data.

Run node --test, then owner-verify setup/login, incognito401, logout, wrong password
and restart login. Never configure the real owner's password through agent tools.
Before merge rollback affects only the feature branch; retain auth/task/history
files. Final cleanup must preserve all three data directories. Hosted release
and multi-user authentication remain incomplete roadmap gates.

## Lock and autofill update

LOCAL_LOCK adds five-minute idle expiry, immediate view clearing on lock/logout,
same-origin tab lock broadcasts and non-renewing local session-status checks.
Password fields request no autocomplete on login and are cleared at lifecycle
boundaries. Browser password managers can ignore that hint; the owner must remove
the saved localhost entry to prevent it being offered again. No stored browser
credential can be erased by this application. Use Win+L before leaving the PC.

References checked2026-10-29:
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
