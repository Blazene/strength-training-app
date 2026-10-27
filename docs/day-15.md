# Day 15: PostgreSQL accounts and workout storage

Better Auth 1.7.14 provides email/password accounts and server-side sessions in
PostgreSQL. Its migrations manage user, account, session, and verification tables.
The app migration adds exercises, workouts, workout_exercises, and workout_sets.
No existing IndexedDB workouts are changed or uploaded by this milestone.

## Backend setup

Use a **free terminal** for setup and migration:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
npm ci
npm run setup
npm run db:migrate
npm run build
```

Expected: dependencies installed, a message that local authentication settings are
ready, up-to-date database migrations, and a successful TypeScript build.

Setup preserves existing database settings in the ignored backend/.env, creates a
private authentication secret if missing, and configures exact localhost/iPhone
origins. It does not print the secret. Keep that file private. For a fresh clone,
replace the example PostgreSQL password with your own local database credentials.

The project PostgreSQL instance must be running. If stopped, use a **free
terminal**:

```sh
/opt/homebrew/opt/postgresql@17/bin/pg_ctl \
  -D "$HOME/Projects/strength-training-app/.local/postgres" \
  -l "$HOME/Projects/strength-training-app/.local/postgres.log" start
```

Expected: server started, or a message that it is already running.

In the **Backend terminal**, start the API and leave it running:

```sh
cd /Users/anurag/Projects/strength-training-app/backend
npm run dev
```

Expected: API running at http://127.0.0.1:4001.

## Schema and migration behavior

Workouts use the account ID plus a client UUID as their primary key. Child
foreign keys include the account ID, so a child cannot reference another owner's
workout. Exercise and set positions preserve the saved order. Numeric checks
reject negative/nonfinite weights and invalid reps. Completion cannot precede
start time. The server derives active/completed status from completed_at.

A migration lock prevents concurrent schema setup. App migrations are transactional
and recorded with a checksum; editing an already applied SQL migration fails
instead of silently changing the database. Seeded exercise IDs match the existing
frontend library. Auth IDs are opaque text values managed by Better Auth; client
workout, workout-exercise, and set IDs remain UUIDs.

Authentication uses hashed passwords, HttpOnly cookies scoped to /api, and Secure
cookies on the iPhone HTTPS origin. Host/origin checks apply before auth and API
handlers. The local server uses an in-memory per-process login rate limiter;
distributed rate limiting, email verification/reset delivery, and production
hosting configuration remain later work before a public release.

Implementation: [Better Auth Express integration](https://better-auth.com/docs/integrations/express)
and [cookie behavior](https://better-auth.com/docs/concepts/cookies).
