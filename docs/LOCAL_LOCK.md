# Local lock, password-field privacy and browser autofill

The application stores only a salted password hash, never a recoverable password.
Password fields are cleared on initial login rendering, submission completion,
logout, page show/hide and return from restored navigation. The login form and
field request autocomplete=off. A browser/password manager may ignore this hint
and refill the field afterward; the website cannot erase its credential vault.
No fake fields, misleading autocomplete tokens or repeated timers erase a
password while the owner is typing.

If Chrome saved the local password, the owner should remove only the saved entry
for127.0.0.1/localhost from Google Password Manager and decline future save prompts.
Keep a known copy in a suitable trusted place first. This removes the browser's
saved copy, not the application's account or password hash. Do not delete auth.json.
Never inspect/export the user's password manager through development tools.

Sessions now have a five-minute idle lifetime plus the original eight-hour
absolute ceiling. Server status checks do not extend idle time. Actual local
data API calls and throttled trusted UI activity acknowledge activity; background
polling is local-only and sends no GitHub/Netlify/AI request. Client timers are
best effort and may be delayed in a sleeping/background browser; the server
enforces expiry before granting access on the next request.

The existing logout control is labeled Lock now / Logout. It immediately hides
and clears loaded lists/unsaved task text and password fields, then requests
server-side revocation. Other same-origin tabs receive a non-sensitive lock
broadcast; periodic read-only session checks also detect revoked sessions.
An acknowledged lock reloads the page. On network failure it reports that only
the view is hidden and asks the owner to stop the server for assured revocation.

Browser autofill is not a session. If a password remains saved, another person
using the same unlocked OS account might log in again. App locking cannot prevent
that. Use Win+L before leaving the workstation. OS protection, recovery, MFA and
public deployment/tenant security remain separate requirements.

Tests cover clearing with synthetic values, immediate hide, tab broadcast,
idle/absolute expiry, activity acknowledgements and non-renewing status checks.
These do not prove a real user's Chrome vault was erased; owner browser cleanup
and the real autofill scenario must be checked manually without sharing secrets.

References checked2026-10-29:
- https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion
- https://support.google.com/chrome/answer/95606
