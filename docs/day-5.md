# Day 5: persist workouts locally

Active workouts and completed history now live in IndexedDB. Starting a session,
adding/removing exercises, and adding/editing/deleting sets are saved before the
screen reports success. Finishing a session writes its history entry and clears
the active workout in the same transaction. Starting another workout preserves
all previous sessions.

Only logged sets are saved. Unfinished form fields and unsubmitted edits remain
in React state. Data belongs to this browser and origin on this device; use the
same URL each time (`localhost` and `127.0.0.1` have separate storage). Clearing
site data removes the saved workouts. This does not yet cache the app for offline
launch or synchronize with PostgreSQL.

## Run

Terminal: Frontend. Leave it running while using the app.

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run dev
```

Expected: Vite prints `http://localhost:5173/`. Open that URL. The backend and
PostgreSQL do not need to run for this feature.

## Verify

1. Start a workout, add Bench Press, and log 60 kg × 8 reps. Wait for "Saved on
   this device", then refresh. The same session and logged set return.
2. Edit that set to 62.5 kg; refresh and check it. Use last set, add a second
   set, delete it, then refresh. Only the edited first set remains.
3. Finish the workout. Refresh: the summary and workout history remain.
4. Start and finish another session. Open the first entry in Workout history;
   its original sets remain. Reopen the URL in a fresh browser tab to verify it.
5. With two tabs open on the same active session, save a set in one and try to
   save in the other. The stale tab shows an error and cannot overwrite newer
   data. Reload that tab before continuing.

## Storage behavior

The version 1 `strength-training` database contains a `workouts` object store.
Its `state` entry holds the active session, completed history (newest first), and
an incrementing revision. Each mutation compares the stored revision inside its
write transaction to prevent stale tabs from overwriting newer workouts.

Startup waits for storage to load. A read failure blocks changes and offers a
retry; invalid stored data is left untouched. A failed write retains the last
saved state and unfinished form inputs. Retrying the action attempts a new
transaction. Save status changes to success only when the transaction completes.

Pending synchronization operations, cloud backup, accounts, and automatic
cross-tab refresh are later work.
