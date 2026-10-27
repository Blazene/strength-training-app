# Day 21: reconnect behavior and visible save/sync state

Local save success still means the IndexedDB workout and pending operation have
committed together. Sync now tracks the download and upload phases separately.

| Display | Meaning |
| --- | --- |
| Unsaved entry | Form input has not been logged; Add set/Save changes keeps it, Reset entry cancels it |
| Saved on this device | Logged changes committed locally |
| Offline | Connectivity changed; in-flight network work was aborted and queued changes remain |
| Downloading account workouts | Pages are being received and validated; none are merged early |
| Uploading | A queued workout is awaiting its exact server acknowledgement |
| Waiting to retry | Changes remain stored; the next retry time and Retry sync are available |
| Server check waiting to retry | Downloads could not complete, even if no upload is pending |
| Sign in to sync / sync paused for this account | Ownership checks paused network changes without reassigning the queue |
| Server update waiting for your unfinished entry | A downloaded change waits for Save/Cancel/Reset |
| Sync needs attention | Validation or conflicting versions require attention; local data remains |
| Synced to your email | The download/merge finished and a final local transaction found no pending, conflicting, or deferred changes |

Offline events abort the current request immediately rather than waiting for the
network timeout. A response may already have committed on the server; its stable
operation ID and receipt still make the later retry safe. Reconnect, app opening,
returning to the foreground, and manual retry resume work. Upload retries retain
persistent backoff. Timers run only while the app is open.

Metadata changes and downloaded workout changes use distinct notifications, so
acknowledgements do not create a same-tab network loop. A remote merge refreshes
React's saved state, with revision checks preventing stale saves from replacing
newer data. The IndexedDB transaction lifecycle remains the [atomic save boundary](https://www.w3.org/TR/IndexedDB/#transaction-lifecycle).

## Verification

- All 23 frontend tests pass, including pure merge invariants and prior logger/
  preview tests.
- All 16 backend checks, including integration subtests, pass against disposable
  PostgreSQL schemas: upgrade preservation, replay, stale writes, handoff, account
  assertions, pagination, deletion records, earlier account/CRUD behavior, and the stale-client upload gate.
- Chromium and Safari/WebKit at iPhone size pass the full previous sync regression
  plus fresh-profile downloads with existing local data, a resumed session,
  protected unfinished inputs, conflict copies, a failed conflict-copy write,
  interrupted page two, a hanging request aborted by offline, offline close/reopen,
  and a deliberately mismatched acknowledgement.
- The version-1 IndexedDB fixture upgrades without losing records, and old
  version-1 opens are rejected to prevent incompatible writers.
- Imported data is not uploaded again, incomplete downloads do not show Synced,
  and replay of a committed request keeps exactly one receipt.

The live iPhone HTTPS address also passed a disposable-account round trip:
refresh, upload, sign in from a fresh browser profile, download without re-upload,
resume with a version-checked handoff, and verify PostgreSQL plus secure cookies.
The test account and its owned records were removed afterward.

Browser-engine checks are automated; the new flow still needs your physical
phone check. The earlier Day 14 physical iPhone test remains recorded separately.

## Check on your iPhone

1. Keep the Mac's PostgreSQL, API, and phone preview running on the same Wi-Fi.
2. Use the existing app address. If it is showing an old version, open the
   [refresh page](https://anurags-macbook-air.local:5443/api/app-update) and tap
   **Refresh app** without changing the hostname or clearing website data.
3. Sign in and enable sync if this address has not been linked yet. Existing
   account workouts should appear; otherwise tap **Sync now**.
4. Wait for **Ready for offline use** and **Synced to your email**. Log a mock set
   offline, close/reopen the app, then reconnect. The pending count should clear
   after confirmation. Use **Retry sync** if the Mac was unreachable.

Sync still uses PostgreSQL on this Mac. Public hosting and production setup are
scheduled for Days 24–25. Days 22–23 remain the final reliability pass.
