# Day 19: retries, duplicates and deletions

A network failure or timeout retains the same operation ID and payload. Automatic
retries use persistent exponential backoff from about one second to one minute,
with small jitter. Manual retry, app opening, and reconnecting can retry promptly.
Authentication failures pause for sign-in. Validation/conflict errors keep the
pending data and show the server's message rather than retrying continuously.
A newer corrected snapshot can supersede an older rejected one.

The server commits the workout, its sequence/deletion state, and the operation
receipt together. Reusing the operation ID with the same normalized payload
returns its previous result. Reusing it for different data returns 409. Receipts
are retained for the lifetime of the account, including across backend restarts.
Per-account transaction locks serialize this low-volume, one-device write flow.
[PostgreSQL transaction advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS)
release at transaction end.

An older sequence cannot overwrite a newer workout. A deletion marker survives
removal of the workout row, preventing delayed requests from recreating it. The
older direct PUT/DELETE endpoints reject changes to workouts already governed by
sync, so they cannot bypass those markers. The History details screen now has a
confirmed **Delete workout** action; removing a set or exercise is represented by
the next full snapshot. Two devices cannot independently edit the same synced
workout in this version.

## Verification

Automated checks use disposable PostgreSQL schemas and fresh browser storage:

- Existing account/CRUD checks plus sync receipt replay, concurrent duplicates,
  changed-payload conflicts, delayed requests, deletions, ownership assertions,
  direct-endpoint protection, and rollback of a failed child replacement.
- Upgrade from the previous local state; sign-in alone uploads nothing.
- Local queue-write failure rolls back the workout and preserves form inputs.
- Lost response after a server commit; reload/retry produces no duplicate sets.
- Newer changes survive an older request's acknowledgement.
- Offline tab close/reopen preserves workouts and the pending queue; completion
  and deletion reconnect correctly.
- Expiry preserves changes; another account receives none; the original account
  resumes uploading after sign-in.
- Reconcile writes from an older cached app; check phone layout and runtime errors.

All 17 frontend checks and 13 backend checks (including integration subtests)
pass. The live iPhone HTTPS address was also verified with a disposable account:
refresh, secure session, local set, explicit upload, and PostgreSQL round-trip;
that account and its test data were removed afterward. Browser verification
runs in Chromium and Safari/WebKit; physical iPhone verification of this new sync
flow remains a user test, separate from the passed Day 14 offline test.

## iPhone check

Use the existing trusted HTTPS address. If an older app is still cached, use the
[app refresh page](https://anurags-macbook-air.local:5443/api/app-update), keeping the
same hostname as your saved workouts. Sign in, enable sync, and wait for
**Synced to your email**. Log an offline mock set, close and reopen, reconnect on
the same Wi-Fi, and check that the pending count reaches zero.

This was the upload-only milestone. Days 20–21 now add downloads, version-checked
handoffs, and safe merging; see [Day 20](day-20.md) and [Day 21](day-21.md).
Keep the same address and website data when updating an existing installation.
