# Day 22: repeatable reliability checks

The repository now includes a browser regression suite rather than relying on
scripts saved in one developer's chat workspace. It runs against the built app,
Express API and PostgreSQL, with separate Chromium and Safari/WebKit profiles at
iPhone size. It includes real browser-process restarts with persistent profiles.

## Setup and run

Use a free Terminal tab. Install the project's dependencies once after pulling
these changes:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
npm ci
cd ../frontend
npm ci
npm run test:e2e:install
npm run test:e2e
```

The browser-install command downloads the browser versions for the pinned
Playwright dependency. The suite runs frontend tests, lint and build; backend
build and database tests; then both browser suites. A failing assertion exits
nonzero. Logs, screenshots and `results.json` go under the ignored project folder
`.local/e2e/<run>/`.

PostgreSQL server tools must be installed. The runner discovers `pg_config` or the
Homebrew PostgreSQL 17 binaries already used by this project. It creates a fresh
temporary cluster on a random loopback port, uses only generated test accounts,
then stops and removes that cluster. It does not read `backend/.env`, use the app's
ports/database, or stop the running app. Browser profiles are also disposable.

If discovery needs help, set `POSTGRES_BIN` to a directory containing `initdb`,
`pg_ctl` and `createdb`. An existing dedicated database can instead be supplied as
`E2E_DATABASE_URL`; only a plain loopback PostgreSQL URL ending in `_test` or
`_integration` is accepted. URL query overrides are rejected. Each run uses its
own generated schema and removes only that schema. A supplied cluster is never
initialized, stopped or removed by the runner.

To focus a run:

```sh
npm run test:e2e -- --browser=chromium
npm run test:e2e -- --browser=webkit
npm run test:e2e -- --browser=chromium --only=offline-update
npm run test:e2e -- --browser=chromium --only=sync
```

`E2E_CHROMIUM_EXECUTABLE` and the standard `PLAYWRIGHT_BROWSERS_PATH` can point to
already installed test browsers. Ordinarily the browser-install command handles
this.

## Verified failure paths

- Existing IndexedDB data upgrades intact; incompatible old opens are rejected.
- Sign-in alone uploads nothing; explicit linking preserves account ownership.
- A failed queue write rolls back the workout and leaves form inputs available.
- Losing a response after a server commit, reloading, and restarting the API
  replay the same operation rather than duplicating sets.
- New edits and deletions survive an older request's acknowledgement.
- Offline set edits, deletion before first upload, close/reopen, workout
  completion, and whole-workout deletion synchronize with the intended values.
- Expired sessions and another account cannot consume or reassign pending work.
- Paginated downloads preserve an unrelated local session, import history without
  re-uploading it, and allow a version-checked logging-device handoff.
- Unsaved form inputs defer server changes; keep-both conflict recovery is atomic
  even when its local write fails.
- Failure or session expiry on page two imports no partial history.
- Offline events abort hanging requests; malformed acknowledgements retain the
  pending operation and retry its original receipt.
- Failed and successful app updates survive a full browser restart offline.
- Delayed focus and a save at the sync-completion boundary have targeted timing
  regressions, rather than depending on machine speed to expose them.

The suite records automated browser-engine results. Physical iPhone verification
remains a separate user check; the earlier Day 14 result is preserved.
