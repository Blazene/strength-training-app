# Day 17: durable changes waiting to sync

Every committed workout change now writes an immutable pending operation and the
workout state in one IndexedDB transaction. If either write fails, neither is
saved and the set form keeps its inputs. The UI reports success after the whole
transaction commits. Network requests run outside that transaction.

The existing `strength-training` database remains version 1. The `workouts` store
keeps `state`, adds `sync:metadata`, and stores operations under
`sync:pending:<UUID>`. Existing active workouts and history are preserved. This
avoids an upgrade that could be blocked by an older open phone tab.

Metadata contains a stable device UUID, an increasing sequence, the linked
account, exact snapshots of known workouts, and the last server confirmation.
An operation contains stable IDs, account/device ownership, sequence, an entire
workout snapshot or a deletion, and persistent retry information. Snapshot
comparison also captures a save made by an older app tab before its next upload.

## Link the device once

1. Open Account and sign in or create an account.
2. Read the address shown under Workout sync.
3. Tap **Enable sync for this device** to upload existing and future workouts to
   that account.

Signing in alone does not upload old local data. Once linked, logging out or
letting the session expire does not unlink or reassign pending work. Logging
while signed out continues to save for the original linked account. A different
account pauses uploads and cannot claim that queue. Account switching with
separate local datasets belongs to later work; use one logging device/account.

Browser transactions follow the [IndexedDB transaction lifecycle](https://www.w3.org/TR/IndexedDB/#transaction-lifecycle).

Day 20 upgrades the same database to version 2 to prevent outdated tabs from
writing the newer unfinished-session format; existing records remain intact.
