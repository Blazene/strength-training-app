# Day 6: see and reuse your previous session

When you add an exercise, its card now shows the most recent completed workout
containing logged sets for that exercise: session date, weights, reps, and saved
set order. Exercises you have never logged show a short empty state.

Choose **Use set 1** (or another set) to fill the weight and reps fields. Adjust
them as needed, then press **Add set**. Copying values does not log a set until
you submit the form. New sets receive new IDs; the original workout stays intact.
Save or cancel an active edit before copying a previous set.

**Use last set** still fills from the current workout's last logged set. Previous
session refers to a completed workout, excluding the active session. The lookup
uses completion timestamps so it also works with history stored out of order.

## Try it

If your frontend is already running, refresh [the app](http://localhost:5173/).
No installation, backend command, or database migration is needed.

If the frontend is stopped, run this in the **Frontend terminal**, then leave it
running:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run dev
```

Expected: Vite prints `http://localhost:5173/`.

1. Complete a workout containing Bench Press with two different sets.
2. Start another workout and add Bench Press. Both sets appear under Previous
   session, with their completion date.
3. Select a previous set. Its values fill the form; the logged-set count stays
   unchanged until you press Add set.
4. Change the weight and log it. Refresh: your new set and the previous-session
   reference both return. The earlier session's values remain unchanged.
5. Finish this session and start another Bench Press workout. Previous session
   now shows the session you just finished.
6. Add an exercise you have never logged. It shows that no previous session is
   available.

## Developer checks

Run in a **free terminal** while leaving the frontend terminal running:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm test
npm run lint
npm run build
```

Expected: five passing lookup tests, no lint errors, and a successful Vite build.
The test command uses the existing Node runtime (Node 22.6+ with type stripping).

Browser verification also covers fresh set IDs, original history preservation,
copy controls during edits, refresh recovery, mobile layout, and all Day 5
persistence/error-recovery checks. Saved data retains the existing IndexedDB
schema. Unfinished form inputs remain temporary, as on Day 5.
