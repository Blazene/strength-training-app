# Day 11: copy previous sets with fewer taps

Copy previous set is now beside the set-entry fields. It copies the matching set
from the previous completed session: when logging set 1 it uses previous set 1,
then set 2, and so on. If this workout has more sets than the previous session,
it reuses that previous session's final set. The source set number and values are
shown directly below the shortcut.

The action fills editable values without logging them. Adjust and press Add set.
Use last set still fills from the current workout's last logged set. To copy a
different prior set, expand View previous sets and choose its Use set button.
Copy controls are disabled during an edit until you save or cancel it.

Newly logged sets get new IDs. Editing, deleting, and copying leave completed
history intact. Saving an edit returns the form to the current workout's last
saved set, rather than keeping an older edited set as the next-set template.
Deleting the set being edited uses the last remaining set, or clears the form if
none remain.

A failed save retains the entered values and edit mode, and shows an error beside
the form. Rapid submissions during a pending save are ignored so that only one
new set is written.

## Try it

1. Complete a workout with different weights or rep counts for at least two sets.
2. Start another workout with that exercise. The previous results are visible
   above the entry form without expanding a long list.
3. Copy previous set, adjust it if needed, and save. The shortcut now points to
   the next prior set.
4. Repeat a current-workout set with one Add set tap using the retained values.
5. Edit an earlier set and save. The next-set form resumes using the latest set.
6. Refresh offline after the app is cached. Saved values, history, and previous
   references remain available.

## Start and verify

For a running production preview, stop it with Control + C in the **Frontend
terminal**, then run:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run build
npm run preview -- --host localhost --port 5173 --strictPort
```

Expected: a successful build and `http://localhost:5173/`. Keep that exact URL to
retain access to existing browser data. If an update is waiting, save any drafts,
close all training tabs, and reopen. The dev server updates automatically.

In a **free terminal**, run:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm test
npm run lint
npm run build
```

Expected: nine passing tests, no lint errors, and a successful build.
Browser checks cover keyboard focus, numeric hints, retained values, single-tap
repeat entry, copy sources, edit/delete transitions, failed-save retry, duplicate
pending submissions, history navigation, mobile touch targets, and offline reload.
