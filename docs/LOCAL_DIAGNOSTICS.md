# Local rule diagnostics and evidence export

The Project Zero local API now adds a rules-v1 analysis to the minimized public
GitHub observation already collected. It performs no additional provider request,
AI inference, write API or infrastructure action. The UI presents facts and
proposed next steps separately; actionsExecuted and autoExecuted are false.

Rules distinguish protected/unprotected main, pending/closed/merged PR, missing/
running/passing/failing CI and truncated check lists. Every fresh observation
retains an unverified deployment finding: GitHub CI/merge is not deployment proof.
Stale/unavailable input only requests fresh evidence; old successes are not
relabelled as current. Original evidence timestamps are preserved.

After checking GitHub, the owner can download a versioned JSON report using the
local browser. Export is explicit, causes no network request and contains the
minimized status snapshot, quota, original observedAt, rules and export time.
The file is not uploaded or sent to AI. The browser uses its normal download
location; saving a report is not automatic registry/task persistence or backup.
If the local fetch fails, export is disabled until a valid result arrives.

Run node --test. Tests cover stale/unknown states, failed and missing CI, unsafe
release inferences, merged/closed PRs and immutability. Test the browser button
and JSON download as a separate integration check. A report may become outdated:
export time does not replace its observation time.

No authentication, project editing, multi-tenant storage or public release is
introduced. Netlify publication and production handlers remain unchanged.
Keep the existing Draft PR and skip marker. Before merge, reverting this
increment on the feature branch withdraws diagnostics/export without changing
production or the prior public-read dashboard.
