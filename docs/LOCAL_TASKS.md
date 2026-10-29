# Local task list

The owner can create a short task, save a rule finding as a task and change status
between todo/doing/done. Done means owner-reported completion, not independently
verified execution. The app performs no task on GitHub, Netlify, AI or a server.

Tasks are plaintext under .netlify/supervisor-tasks/tasks.json, already ignored by
Git and outside public output. No task data is sent to the public connector or
included in the evidence-report export. Do not enter credentials or sensitive
customer information. Auth, encrypted private storage and multi-user use are not
implemented; use this prototype only on the owner's trusted local workstation.

Up to100 tasks,160 characters per title. At the cap, creation is rejected; old
tasks are not silently deleted. Status can be changed back to reopen a task.
There is deliberately no delete or technical action-execution endpoint.

Writes require exact localhost Host/Origin, application/json and a random
per-server anti-CSRF token obtained through the same local origin. The token is
not user authentication and does not protect against malicious local software.
Other routes remain read-only. Bodies are bounded at4096 bytes; unknown actions
and unexpected input fields are rejected. Titles render via textContent.

Store schema, size and paths are checked; malformed files are preserved, links
are rejected and writes use an exclusive temp file plus atomic rename. Stop and
restart retains tasks. Refresh the page after restart to obtain the new write
token. No credentials, keys or task title are printed in server logs.

Run node --test and verify create/status/reopen/restart in the local browser.
Before merge, reverting this increment withdraws the UI/API without changing
production. Preserve task/history files for recovery; they are user data even
though stored under .netlify. Final cleanup must not recursively remove .netlify
without preserving both data subdirectories first.
