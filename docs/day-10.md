# Day 10: faster weight and rep entry

The set form now sits before the logged-set list. The previous session stays
visible as a compact reference; expand View previous sets to inspect or copy any
individual set. Logging more sets no longer pushes the entry form down the card.

- Weight requests a decimal keyboard; reps requests a numeric keyboard.
- The weight keyboard's Enter/Next action moves to reps without saving.
- Enter/Done from reps submits the set.
- Adding an exercise focuses its weight field. Copying or editing selects the
  value, so typing replaces it directly.
- After a successful new set, the weight and reps remain ready for the next set.
  Repeating those values takes one Add set tap.
- Inputs and primary form buttons are at least 56 px tall. Other action buttons
  and the previous-set expander are at least 48 px tall.
- After an error, the first invalid field is focused. Zero weight is valid;
  decimal weights can use a dot or comma. Rep counts must be positive integers.

Inputs use text fields with numeric keyboard hints so values can be selected for
replacement and validated consistently. Workouts still store numeric weight/reps,
using the existing IndexedDB schema.

## Try it

1. Start a workout and add an exercise. Its weight field receives focus.
2. Enter 62.5, press Enter/Next, enter 8 reps, then press Enter/Done.
3. Both values remain in the form. Press Add set to log the same values again.
4. Tap the weight field and type a replacement. The selected value is replaced.
5. Try a blank weight or fractional reps. The app focuses the invalid field and
   shows a specific message, without logging another set.

A fresh page restores the latest saved set as the template for the next one.
Unfinished changes still do not survive refresh. Navigating between Current
workout and History keeps the current draft in memory.

Keyboard hints and focus were checked in Chromium with mobile emulation. Test the
actual keyboard on your phone during the roadmap's Day 14 workout.
