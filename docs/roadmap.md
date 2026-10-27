# Original four-week roadmap and current checkpoints

This records the user's supplied roadmap. Earlier implementation checkpoints
completed some later features ahead of schedule; use the milestones below for
future day requests rather than inferring a different order.

| Days | Original milestone | Current state |
| --- | --- | --- |
| 1–2 | React/Express setup, Git, local PostgreSQL, model | Implemented |
| 3–4 | Active workout, exercise picker, set add/edit/delete | Implemented |
| 5–6 | IndexedDB persistence and active-session restore | Implemented |
| 7 | Mock workout and friction fixes | Automated mock flow verified; offline/PWA was also added early |
| 8–9 | Completion, history, previous-session sets | Implemented and verified; dedicated history/details navigation completed |
| 10–11 | Numeric keyboards, large buttons, focus, copy previous set | Implemented and verified: form stays near heading, saved values remain ready, keyboard focus and matching prior-set shortcut |
| 12–13 | App caching, PWA, offline reopen | Implemented early at the Day 7 checkpoint |
| 14 | Full workout on the user's phone, ideally in the gym | Pending actual phone/gym test |
| 15–16 | PostgreSQL schema, Express validation/endpoints, account auth | Pending; backend currently has health endpoints |
| 17–18 | Persistent local sync queue, upload and acknowledgement | Pending |
| 19–20 | Idempotent retries, edits/deletions, pull after login | Pending |
| 21 | Interrupted requests, reconnect, save/sync indicators | Pending |
| 22–23 | Full offline/failure/session-expiry tests and data-loss fixes | Final reliability pass pending |
| 24–25 | Frontend/API/database hosting, HTTPS, production auth | Pending; choose hosting that fits free/no-payment-information preference |
| 26 | Real workout with deployed version on phone | Pending |
| 27 | README, setup, architecture, limits, screenshots | Pending final project documentation |
| 28 | Bug buffer and short demo | Pending |

Version 1 assumes one logging device at a time. AI recommendations, social feeds,
nutrition, wearables, advanced analytics/programming, simultaneous editing, and
multiple authentication providers remain outside the first version.

A successful release preserves an offline gym session after closing/reopening and
syncs it later. IndexedDB saves data; the service worker caches the app. Neither is
a guaranteed backup. Server synchronization and per-account ownership must be
implemented and tested before describing workouts as synced.
