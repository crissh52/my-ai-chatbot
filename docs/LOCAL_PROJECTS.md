# Personal project registry — local metadata

An authenticated owner can register a name and optional GitHub owner/repo, hide it and
restore it. Project Zero is a fixed built-in entry. Up to20entries total,
including Project Zero and hidden entries. Hiding is reversible and does not
delete data or free a slot. Duplicate repositories are rejected case-insensitively.

New projects remain not_connected. Registration is metadata only, not evidence
of repository ownership, API permissions, remote availability or a connection.
No arbitrary URL is requested. The fixed public GitHub connector, diagnostics,
history and tasks still belong to Project Zero. Future connectors need explicit
authorization/consent and project-scoped storage before expanding these operations.
The server does not probe another project just because it appears in the registry.

Data is plaintext under .netlify/supervisor-projects/projects.json, ignored by Git
and outside static publication. Names up to80characters, owner/repo only; no
tokens, URLs with secrets, source or private customer content. An empty repository
means not yet declared; it never invents an observed repo or a connected state. Store validates
schema/size/paths and preserves malformed existing files. Atomic writes use an
exclusive temporary file. Unknown API fields/actions are rejected.

/api/projects requires the existing local Auth session. Writes additionally need
same-local Origin, CSRF token, JSON and bounded bodies. UI renders textContent.
Logout hides the list and clears unsaved inputs. No new cloud, AI, billing,
background polling or production endpoint is introduced. Multi-user/tenant
isolation and hosted Auth remain incomplete.

Run node --test. Then owner-check create, duplicate rejection, hide/restore,
restart persistence and unchanged Project Zero data. Use only a repo you own or
are permitted to register. The tests use synthetic metadata and no external API.

Keep the existing feature branch and Draft PR. Before merge, revert this increment
to withdraw the registry while retaining the data file for recovery. Final
PowerShell cleanup must preserve supervisor-projects alongside auth/tasks/history.
