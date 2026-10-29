# Local observation history

Manual successful public GitHub observations are minimized and saved under
.netlify/supervisor-history/history.json. The existing /.netlify/ gitignore rule
excludes this runtime data; the static publish directory is elsewhere and never
includes it. Do not upload this folder or reports with the source bundle.

Schema version1 stores only observation time, main/PR SHAs, protection, PR state,
Draft/merged and CI status/conclusion. No titles, keys, source, logs or customer
content. This is plain local JSON, not encrypted multi-user storage or a backup.

At most50 observations are retained, newest first; a new observation replaces
the oldest after the limit. Repeated cached observations are not duplicated,
stale/unavailable responses do not add records, and older observations cannot
replace newer ones. Comparison covers only the listed fields of the latest two
records. No change in these fields does not prove infrastructure is unchanged.

Opening the page loads /api/history from localhost only. It does not refresh
GitHub or relabel history as current. Restart clears the API cache but retains
history. A new manual GitHub check may add a record even if states are unchanged.
JSON reports now include this minimized local history alongside their observation.

The store bounds file size, validates schema, rejects linked directories/files,
uses exclusive temporary files and atomic rename. Invalid existing data is kept
and a separate history-unavailable status appears; valid GitHub evidence is still
shown. These checks do not promise protection against a malicious local OS user.

Run node --test. Verify a real local observation, restart the server and confirm
history remains without another GitHub call. No Auth, task/project editing,
background monitor, cloud storage, Netlify request or AI inference is introduced.

Rollback: stop local server and revert this increment on the feature branch.
Leave the data file intact if needed for recovery. Do not delete a cache/history
folder belonging to another project. Hosted release and Auth gates remain pending.
