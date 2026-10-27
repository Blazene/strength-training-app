# Day 23: reliability fixes and results

Three reproducible issues were fixed during the final reliability pass.

## Interrupted app updates

Previously, an online navigation could replace cached HTML immediately. If its
new JavaScript then failed to download, the offline app pointed to a missing file
and could not reopen, although IndexedDB still held the workout.

Builds now include `/app-shell.json`, listing the complete app files. Navigation
checks that the HTML's entry resources belong to that build, downloads the asset
batch, and replaces cached HTML last. A failed download, timeout, or storage
write retains the previous usable shell. Completed updates still become the
cached version. IndexedDB data and the existing wait-for-tabs worker-update policy
are preserved. The [Cache API's batch behavior](https://w3c.github.io/ServiceWorker/#cache-addAll)
supports the asset commit boundary.

Both Chromium and WebKit reproduce the original failure and now pass failed-update
and successful-update checks followed by a real offline browser restart.

## Delayed focus after saving

A post-save animation callback could move focus after the person had already
chosen the next field, allowing quick input to land in the wrong field. Delayed
focus and selection now check both the current focus and subsequent interactions.
Newer input is not reset by an earlier save callback. The existing keyboard hints,
copy shortcuts and saved-value templates remain available.

## Premature sync completion

A set committed between the completion transaction and its final queue read could
show Synced while that set was still pending. The controller now checks the fresh
pending/conflict/deferred state before publishing completion, and starts another
pass if new work appeared. The regression inserts a save at this exact boundary
and pauses the next account check so a false status cannot be hidden by a fast
follow-up request.

## Results

- All 24 frontend native tests, lint and production build pass.
- All 16 backend unit/integration tests and the build pass against isolated PostgreSQL.
- Full Chromium and Safari/WebKit suites pass, including the complete logger,
  offline edits/deletions, session expiry, backend restart, downloads, conflicts,
  update failures and timing regressions.
- The existing iPhone HTTPS address also passes a fresh WebKit check: app refresh,
  local set upload, fresh-profile sign-in/download and resumed logging all reach
  PostgreSQL correctly. Session cookies are Secure and HttpOnly; the app reports
  ready for offline use. The disposable verification account was removed.
- Test databases, schemas and browser profiles are cleaned up after the runs.
- The suite's database guard refuses the app database, remote hosts and URL
  connection overrides.

Run instructions and the full scenario list are in [Day 22](day-22.md). Public
hosting remains Days 24–25. This milestone does not claim verification of a
public deployment or a new physical iPhone gym session.

To use the update on the existing phone installation, save any unfinished set,
close other workout tabs, open the
[refresh page](https://anurags-macbook-air.local:5443/api/app-update), and tap
**Refresh app**. Keep the same hostname and website data. The Mac API and preview
still need to be running on the same Wi-Fi.
