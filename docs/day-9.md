# Day 9: previous-session context while logging

The Days 8–9 milestone is now complete: workout completion, history/details, and
previous-session sets beside each active exercise. Previous-session lookup was
introduced at the earlier Day 6 checkpoint; this day verifies it with the full
history and completion flow.

The reference uses the latest completed session containing logged sets for the
same exercise ID. It excludes the active workout, skips empty sessions, works
independently of history order, and preserves saved set order. First-time exercises
show a clear empty state. Choosing older workout details in History does not
change what appears as the previous session in the active workout.

Use set 1 (or another prior set) fills editable weight/reps fields. It does not log
anything until Add set is pressed. A newly logged set gets a new ID. Editing or
deleting it never changes the original completed workout. An active edit must be
saved or cancelled before copying a prior set.

## Try it

1. Complete Bench Press with 60 kg × 8 and 62.5 kg × 6.
2. Start another Bench Press workout. Previous session shows both saved sets.
3. Copy the first set and adjust it to 65 kg before logging. Check the older
   workout in History: its original 60 kg set remains unchanged.
4. Return to Current workout. The reference still shows the last completed
   session, not the active workout or the details selected in History.
5. Finish the workout. The next Bench Press workout now references this newly
   completed session.
6. With the app cached, disconnect and reopen it. Saved history and previous sets
   remain available. Unsubmitted form inputs are not restored after a refresh.

## Checks

In a **free terminal**, leaving the frontend terminal alone:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm test
npm run lint
npm run build
```

Expected: five passing lookup tests, no lint errors, and a successful build.
Browser checks also cover cancelled completion, empty exercises, history during an
active edit, original-session preservation, latest-session selection, saved data
after refresh, and offline history/details. Accounts and sync remain on Days 15–21.
