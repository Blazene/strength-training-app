# Data model

## Account identity (Days 15–16)

Better Auth owns the PostgreSQL user, account, session, and verification tables.
User IDs are opaque text identifiers. Password hashes live in its credential
account records; session identifiers are delivered through HttpOnly cookies.
Email/password login is the only enabled provider.

## Shared exercise library

exercises: id (stable text slug), name. The eight initial IDs match the frontend.
API writes use the canonical library name, not a client-supplied display name.

## Server workout tables

- workouts: user_id + UUID id primary key; started_at, nullable completed_at,
  generated active/completed status, created_at, updated_at.
- workout_exercises: user_id + UUID id primary key; parent workout_id,
  exercise_id, position. Foreign key (user_id, workout_id) enforces owner alignment.
  Exercise and position are unique within the workout.
- workout_sets: user_id + UUID id primary key; parent workout_exercise_id,
  position, weight_kg (non-negative finite numeric), reps (positive safe integer).
  Foreign key (user_id, workout_exercise_id) enforces owner alignment.

Parent deletion cascades to child rows. Replacing a workout and its ordered child
rows is one transaction. Owner/timeline and parent/order indexes support queries
and cascading deletes. The server derives owner IDs from the verified session;
clients cannot assign ownership through JSON fields.

## Existing local storage

The IndexedDB state still contains its revision, active workout, and completed
history. Account actions do not alter it. It is device-local data, not yet bound
to an uploading account. React state holds unfinished forms. The service worker
caches the app and excludes API responses.

## Offline synchronization design (Days 17–20)

- Retain client-generated UUIDs for workouts, workout exercises, and sets.
- Save local changes and pending operations in one IndexedDB transaction.
- Give each operation a UUID and bind pending work to the correct account.
- A retry must not apply the same operation twice.
- Keep deletion records until the server acknowledges them.
- Preserve pending work through logout/session expiry and never send it to another account.
- Pull owned server data after login without silently replacing unsynced local work.
- Version 1 assumes one logging device at a time.

The queue, idempotency ledger, tombstones, and pull/merge rules are not implemented
by Days 15–16. Existing local data must not be automatically uploaded merely
because an account signs in.

## Previous-session lookup

Use the most recent completed workout containing logged sets for the exercise.
Exclude the active workout and preserve saved set order.
