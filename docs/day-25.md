# Day 25: production verification

Status: **live and verified**, 28 October 2026.

- Public app: <https://strength-training-app-six.vercel.app>.
- Deployment: `dpl_E82SnQJH3sZEP9WgQuGFSXR7FsVh`, production, READY.
- Both verified production aliases return 200 for the HTML and database health
  endpoint without a Vercel sign-in or bypass token.
- Full staged Chromium and WebKit runs passed. The public address then passed the
  full WebKit run again, including an offline browser-process restart.
- Generated verification accounts and their workout records were removed. The
  original transferred account remains intact. Temporary staged share links were
  revoked after testing; deployment protection stays enabled for build URLs.
- Runtime-log inspection returned no records for the released build. No separate
  uptime monitor, log drain, or paid observability service was added.

Production configuration regression checks pass: exact HTTPS origins, no local
production defaults, explicit hosted database configuration, verified TLS, and
only the platform-provided build hostname added to the trusted list. A separate
PostgreSQL integration check verifies that login limits survive alternating
requests between two API instances and cannot be reset through a forged client
identity header.

The complete local reliability suite passes: 24 frontend tests, 20 backend tests,
lint, both builds, and Chromium/WebKit browser flows against isolated PostgreSQL.
The hosted schema is initialized; applying migrations twice succeeds.

The first online check caught a platform packaging issue that a successful build
alone did not reveal. The source-entry configuration in Day 24 fixes it; the
staged `/api/health/db` endpoint returns 200 with `database: connected` over HTTPS.

Passing hosted checks cover signup, secure cookies, local logging, upload, offline browser
process restart, offline completion, reconnection without duplicate sets, fresh
profile sign-in/history download and previous-session results. They use generated
disposable accounts and remove only those accounts and their test records. The
transferred user account is checked before and after the run.

This is automated verification. The physical phone workout on the hosted address
is Day 26. Email verification/reset delivery, simultaneous logging from multiple
devices and guaranteed backups remain outside this first version.


## Use on iPhone

Open the public app in Safari, sign in with your existing account, and enable
sync for this device. Wait for **Ready for offline use** before leaving connectivity.
Add the public address to the Home Screen. Once loaded and cached, this hosted
version can log offline without the Mac; reconnect while it is open to sync.

Keep the old Mac-address installation and its website data for phone-only
workouts that have not been transferred. Moving to a different origin does not
copy IndexedDB. The deployment copied one existing server account and zero
server-saved workouts, with explicit user authorization.
