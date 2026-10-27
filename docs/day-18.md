# Day 18: uploads and server acknowledgements

With sync enabled, opening the app, reconnecting, returning to the app, a saved
change, and **Sync now** trigger a sync attempt. Uploads run while the app is open;
there is no dependency on background uploads after it closes. Local logging does
not wait for the server.

`POST /api/sync` accepts one operation with an expected account ID. The verified
session supplies the owner; a cookie switching to another account between the
account check and upload returns 403. The same-origin API remains excluded from
the service worker cache.

The sender chooses the newest full snapshot for each workout. This includes the
result of earlier set edits/removals and avoids replaying every intermediate
snapshot after an offline session. Pending entries remain stored until a valid
server acknowledgement identifies the expected account and operation. Then one
IndexedDB transaction removes only the acknowledged operation and older changes
covered by that snapshot. A newer change saved during the request stays queued.

The status panel distinguishes saved locally, syncing, waiting to retry, a
required sign-in/account mismatch, and a server-confirmed sync. The confirmation
time means an upload was acknowledged, not that a background process is running.

## Start the updated API

From a free Terminal tab, with the project's local PostgreSQL running:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
npm run db:migrate
npm run build
npm start
```

The additive `002_sync.sql` migration creates receipt and deletion/version tables.
It does not change or delete existing accounts or workouts. The migration runner
checks every ordered migration's checksum and is safe to run again.

Keep the API and phone preview running. Sync currently reaches PostgreSQL on this
Mac; public hosting is still scheduled for Days 24–25.
