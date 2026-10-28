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
| 12–13 | App caching, PWA, offline reopen | Implemented and verified in Chromium/WebKit; active-cache validation, repair, and stalled-network fallback added |
| 14 | Full workout on the user's phone, ideally in the gym | Passed on iPhone on 27 Oct 2026: offline reopening, saved workouts, and history correct; no issues reported |
| 15–16 | PostgreSQL schema, Express validation/endpoints, account auth | Implemented and verified: Better Auth accounts, owned transactional workout CRUD, validation, and first-party Mac/iPhone sessions |
| 17–18 | Persistent local sync queue, upload and acknowledgement | Implemented: atomic queue/save, explicit account binding, uploads on opening/reconnect/save/manual retry, account-checked acknowledgements |
| 19 | Idempotent retries and safe edits/deletions | Implemented: persistent backoff, receipt replay, sequence guards, deletion markers, offline history deletion, and account isolation |
| 20 | Pull server data after login and merge safely | Implemented: paginated downloads, atomic merge, preserved pending work/drafts, unfinished sessions, version-checked handoff and keep-both conflict recovery |
| 21 | Interrupted requests, reconnect, save/sync indicators | Implemented and verified in Chromium/WebKit: immediate offline abort, partial-download safety, retry timing, confirmed sync state, and invalid-acknowledgement recovery |
| 22–23 | Full offline/failure/session-expiry tests and data-loss fixes | Implemented and verified: repository browser suite with isolated PostgreSQL, offline browser restarts, API restart/expiry recovery, atomic app updates, focus protection and sync-completion race fix |
| 24–25 | Frontend/API/database hosting, HTTPS, production auth | Live and verified: Vercel Hobby + Neon Free, one HTTPS origin, secure production accounts, shared login limits, hosted Chromium/WebKit tests and public Safari/WebKit offline restart/sync checks |
| 26 | Real workout with deployed version on phone | Pending |
| 27 | README, setup, architecture, limits, screenshots | Complete: project/frontend READMEs, verified fresh-clone setup, architecture/sync flow, current limitations and four reviewed screenshots with synthetic data |
| 28 | Bug buffer and short demo | Pending |

Version 1 assumes one logging device at a time. AI recommendations, social feeds,
nutrition, wearables, advanced analytics/programming, simultaneous editing, and
multiple authentication providers remain outside the first version.

A successful release preserves an offline gym session after closing/reopening and
syncs it later. IndexedDB saves data; the service worker caches the app. Neither is
a guaranteed backup. Upload synchronization and per-account queue ownership are implemented. A sync
status requires confirmed uploads and a completed download/merge with no pending or deferred changes.
