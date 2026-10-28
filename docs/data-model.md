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

## Local storage and synchronization (Days 17–21)

The version-2 IndexedDB database keeps the existing `workouts` store and retains `state` (revision, active workout,
completed history, optional other unfinished workouts). Additional keys hold `sync:metadata` and immutable pending
operations under `sync:pending:<UUID>`. State and its operations commit together.
The UI's unfinished form inputs remain in React state.

Metadata records the stable device UUID, monotonic sequence, explicitly linked
account, exact serialized snapshots, server versions, conflict/deferred records,
and last upload/download/complete-sync times. Old
workouts migrate into the queue without changing `state`; signing in alone does
not upload them. Once the user enables sync, ownership persists through logout,
offline logging and session expiry. Another account cannot claim those operations.

Each pending operation has its UUID, owner/device, sequence, workout UUID,
put/delete action, complete snapshot, optional base version, and persistent
attempt/backoff/error fields.
The newest snapshot covers older changes to the same workout. Only a valid server
acknowledgement lets the client remove that operation and covered older entries.
Newer concurrent saves stay pending. Explicit keep-both resolution atomically
replaces a conflicting queued intent with a separate saved copy and its new queue
entry; a failed resolution changes neither. Comparing exact snapshots also detects
writes from an older cached app that does not yet write queue entries.

## Server synchronization tables

- `sync_operations`: (user_id, operation_id) primary key, normalized request hash,
  workout/device IDs, sequence, applied/superseded outcome, acknowledged version,
  and receipt time. Old receipts retain their original hash and nullable version.
- `workout_sync_state`: (user_id, workout_id) primary key, current logging device
  (nullable for direct-API records), its highest applied sequence, server version,
  deletion flag and update time. It intentionally has
  no foreign key to workouts, so deletion markers survive parent removal.

A transaction commits normalized workout changes, sync state and receipt
atomically. Identical retries return the original outcome; changed payloads under
an existing ID conflict. Older sequences cannot replace newer data. Direct
PUT/DELETE endpoints cannot bypass sync state. Account foreign keys cascade only
when the account itself is deleted. Receipts and deletion markers are retained.

The API verifies session ownership and the expected account on each upload and
download page. A fresh base version allows a handoff to another logging device;
stale device writes conflict. Direct API writes also record versions/tombstones
until sync takes control of that workout. Use one logging device at a time.

Downloads are keyset-paginated by workout UUID. Each page reads one database
snapshot; all pages must validate before one local merge transaction. Pending
local edits and deletions remain protected, and clean imported snapshots become
the new baseline without creating upload operations. Missing IDs never imply
deletion. Server deletion markers remove clean local copies. Unsaved form inputs
wait for Save/Cancel/Reset before their workout can be replaced.

The current active workout remains selected, with other unfinished sessions in
`otherActive`. History uses completed workouts only. A successful remote merge
updates React state; revision checks still prevent a stale write.

Sync checks on app opening, reconnecting, returning, saving, and manual retry.
It does not depend on the app running after it closes. A complete-sync marker
requires no pending operations, conflicts, or deferred updates. Service workers
cache app files and exclude API responses.

## Previous-session lookup

Use the most recent completed workout containing logged sets for the exercise.
Exclude the active workout and preserve saved set order.

## Production authentication storage (Days 24–25)

Better Auth also manages a `rateLimit` table for production login counters.
Production instances share these counters in PostgreSQL; local development uses
in-memory rate limits. Hosted migrations run with production configuration to
create the required auth schema, then the checksummed application migrations.
Session cookies remain origin-specific even when account data is copied to
another database.
