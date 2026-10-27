# Day 8: completed workouts and history

This follows the original roadmap's Days 8–9 milestone. Workout completion was
introduced earlier; this checkpoint completes the history flow.

- Finish requires at least one logged set and a confirmation.
- Only logged sets are included. Exercises without logged sets are omitted.
- Saving the completed workout and clearing the active session happen in the same
  IndexedDB transaction.
- The summary shows the completion date, duration, exercise count, set count, and
  every saved set in order.
- History is a separate view, reachable from Home and during an active workout.
  Sessions appear newest first, with exercise names and counts.
- Select a session to open its details. Viewing it does not modify the workout.
- Return with Current workout to continue the active session. Navigation preserves
  unfinished inputs and active edits; refreshing still restores only saved data.

## Try it

1. Start a session and log Bench Press sets. Add an exercise without logging sets.
2. Finish and confirm. The empty exercise is excluded from the summary.
3. Open History, then select the session. Check its date, counts, and ordered sets.
4. Go Home, start another workout, and enter an unfinished set.
5. Open History and inspect an earlier workout. Choose Current workout: the
   unfinished form is still there.
6. Finish a second workout. Both completed sessions remain in History after a
   refresh.

Keep using [the same app URL](http://localhost:5173/) so your existing local data
remains available. For a running dev server, refresh. For a running production
preview, stop it with Control + C in the **Frontend terminal**, then run:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run build
npm run preview -- --host localhost --port 5173 --strictPort
```

Expected: successful build and `http://localhost:5173/`. Leave the preview running
for the first online visit. If a cached version shows an update notification, close
all training tabs and reopen to activate the new version.
