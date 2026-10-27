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

## Local storage and synchronization (Days 17–19)

The version-1 IndexedDB `workouts` store retains `state` (revision, active workout,
completed history). Additional keys hold `sync:metadata` and immutable pending
operations under `sync:pending:<UUID>`. State and its operations commit together.
The UI's unfinished form inputs remain in React state.

Metadata records the stable device UUID, monotonic sequence, explicitly linked
account, exact serialized snapshots and last server-confirmed upload time. Old
workouts migrate into the queue without changing `state`; signing in alone does
not upload them. Once the user enables sync, ownership persists through logout,
offline logging and session expiry. Another account cannot claim those operations.

Each pending operation has its UUID, owner/device, sequence, workout UUID,
put/delete action, complete snapshot, and persistent attempt/backoff/error fields.
The newest snapshot covers older changes to the same workout. Only a valid server
acknowledgement lets the client remove that operation and covered older entries.
Newer concurrent saves stay pending. Comparing exact snapshots also detects
writes from an older cached app that does not yet write queue entries.

## Server synchronization tables

- `sync_operations`: (user_id, operation_id) primary key, normalized request hash,
  workout/device IDs, sequence, applied/superseded outcome and receipt time.
- `workout_sync_state`: (user_id, workout_id) primary key, original device,
  highest applied sequence, deletion flag and update time. It intentionally has
  no foreign key to workouts, so deletion markers survive parent removal.

A transaction commits normalized workout changes, sync state and receipt
atomically. Identical retries return the original outcome; changed payloads under
an existing ID conflict. Older sequences cannot replace newer data. Direct
PUT/DELETE endpoints cannot bypass sync state. Account foreign keys cascade only
when the account itself is deleted. Receipts and deletion markers are retained.

The API verifies session ownership and the expected account on each upload.
Version 1 uses one logging device/account; attempting to sync an existing workout
from a different device conflicts rather than overwriting it. Uploads resume while
the app is open. Service workers cache the app and exclude API responses.

Day 20 will add server retrieval and safe merging after login. There is currently
no automatic download to a new device and no simultaneous-device editing.

## Previous-session lookup

Use the most recent completed workout containing logged sets for the exercise.
Exclude the active workout and preserve saved set order.
