# Day 16: account UI and protected workout endpoints

Open Account in the app to create an account, sign in, or sign out. Passwords
require at least 12 characters. Closing the panel clears its password field.
Registration and sign-in use server sessions; tokens are not stored in IndexedDB
or localStorage. Existing workouts remain device-local, including after sign-out
or session expiry. Automatic upload is scheduled for Days 17–18.

The optional account panel loads account status only when opened. If the account
service is unavailable, the workout logger remains usable. Neither signing in nor
reconnecting implies that local workouts have synced.

## Same-origin phone and Mac access

The dev server and Vite production preview proxy /api to the loopback backend.
The HTTPS phone preview also proxies /api while preserving the public host and
setting the HTTPS protocol itself. This keeps Safari requests first-party and
selects Secure cookies for the HTTPS address. The setup HTTP server continues to
serve only its instructions/public certificate. API responses are never cached by
the service worker.

To update the running phone preview, stop it with Control + C in its terminal,
then run in a **free terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run phone
```

Expected: build success and the existing phone setup/HTTPS addresses. The same
local CA is reused, so an already trusted iPhone certificate need not be installed
again. Use the same HTTPS app address to retain your phone's local workouts.
Keep the backend and database running for account actions.

If using the Mac production preview, rebuild and restart it in the **Frontend
terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run build
npm run preview -- --host localhost --port 5173 --strictPort
```

If an app update is waiting, save unfinished entries, close all training tabs,
and reopen. Use Account → Create an account, then test Sign out and Sign in.

## API

All routes below require a valid session. The account ID always comes from that
session. A browser mutating request must include its exact allowed Origin; the
same-origin app sends it automatically.

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/me | Current account's public ID, name, and email |
| GET | /api/exercises | Shared canonical exercise library |
| GET | /api/workouts?limit=50&offset=0 | This account's summaries, newest first, with nextOffset |
| GET | /api/workouts/:id | This account's full workout with ordered exercises/sets |
| PUT | /api/workouts/:id | Create or replace this account's workout atomically |
| DELETE | /api/workouts/:id | Delete this account's workout and child rows |

The PUT body uses the current client model: id, startedAt, optional completedAt,
and exercises containing id, exerciseId, optional name, and sets of id/weightKg/reps.
Timestamps are UTC ISO strings. The URL UUID must match id. Canonical exercise names
come from the server library, regardless of a submitted display name.

Unknown/owner fields, duplicate UUIDs/exercises, invalid dates, negative weights,
fractional/unsafe reps, and invalid completion are rejected with 400. Payloads are
limited to 256 KiB, 30 exercises, and 100 sets per exercise. ID collisions return
409 and roll back the transaction. Missing or other-owned resources return 404;
missing/expired sessions return 401. Pagination is bounded to 1–100 entries.

UUIDs are namespaced by account: the same UUID in another account is an independent
record and cannot overwrite the original owner's record. Repeating an identical
PUT replaces the same record rather than duplicating sets. Persistent operation
acknowledgements, sync retry rules, tombstones, and pull/merge behavior are still
scheduled for Days 17–20.

## Verification

In a **free terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
npm test
npm run typecheck
npm run build
```

Expected: four validation tests pass, the separate database integration test is
skipped without TEST_DATABASE_URL, and TypeScript checks/build succeed.

To run real database tests, provide TEST_DATABASE_URL for a dedicated database
whose name ends in _test or _integration. Tests create and remove their own schema,
choose a free HTTP port, and never truncate existing tables:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
TEST_DATABASE_URL='postgres://your_test_role@127.0.0.1:5548/strength_integration' npm run test:integration
```

Eight integration checks (including the parent test) cover account isolation,
hashing/cookies, session revocation/expiry, ordered CRUD, replay, transaction
rollback, oversized payloads, and password rate limits. Chromium HTTP and WebKit
HTTPS tests verify signup/sign-in/sign-out, persistence after reload, expiry,
unchanged local workouts, and continued logging during account-service failure.
