# Day 20: download account workouts and merge safely

After signing in and enabling sync for an address, the app downloads account
workouts before sending pending local changes. Existing linked devices do this
on opening, reconnecting, returning to the app, saving a change, or **Sync now**.
A fresh browser still needs **Enable sync for this device**; signing in alone
does not upload or bind unrelated local workouts.

`GET /api/sync/workouts` requires the expected account ID as well as a verified
session. It returns pages of 20 entries, including full ordered exercises/sets,
server versions, source-device sequences, and deletion markers. UUID keyset
pagination includes deletion markers. A page's records and versions use one
[PostgreSQL repeatable-read snapshot](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-REPEATABLE-READ).
The next full check picks up changes added earlier in the key order during a
previous check. Missing IDs are never treated as deletions.

Every page must download and validate before a single IndexedDB merge commits.
A timeout, interruption, bad cursor, or account mismatch does not import a partial
history. The merge leaves pending local edits/deletions intact, records imported
snapshots as its baseline, and does not queue downloaded data for upload again.
The workout screen updates without requiring a page reload.

The current local session stays selected. Other downloaded unfinished sessions
are stored under `otherActive` and listed as **Other unfinished workouts**. Resume
swaps the selected session while retaining the previous session. Completed
sessions appear in History and feed the existing previous-session reference.

## Resuming on another device

The additive `003_downloads.sql` migration adds server versions, preserves old
receipts, and initializes version records for earlier direct-API workouts. A
freshly downloaded version lets another device take over its next save. A stale
base version is rejected instead of overwriting newer server data. The original
device's late retries still cannot restore old sets or deleted workouts.

Use one logging device at a time. This is a checked handoff, not simultaneous
collaborative editing or automatic set-by-set conflict resolution.

## Unfinished inputs and conflicting changes

Unsaved form inputs remain local UI state. Downloads wait before replacing their
workout; save, cancel an edit, or **Reset entry** to proceed. Clean set-entry values
follow the latest downloaded set. Imported history can update independently.

If another device changed a workout while this device has pending edits, its
saved local copy remains intact. **Keep both versions** makes a new workout with
new workout/exercise/set IDs for the local copy and adopts the latest downloaded
server version for the original. If the server deleted the original, that deletion
is retained and the local sets survive as a new workout. Choosing this action for
a local deletion keeps the server workout.

Copying the saved data, replacing the original queued intent, recording the
server baseline, and queuing the new copy happen atomically. A failed local write
leaves the original queue and data intact. Unfinished form inputs must be saved
or cancelled first; they are never silently included in the copy.

IndexedDB upgrades to version 2 without replacing its store or records. This
prevents old version-1 tabs from writing metadata that ignores other unfinished
sessions, avoiding repeated contradictory queue entries. Existing connections
close on version change; if a tab blocks the upgrade, close it and retry loading.
Optional metadata fields add server versions, conflicts, deferred updates, and
last download/completion times. Existing workout IDs, queued operation IDs, and earlier receipt hashes are
preserved. Previously recorded requests can still replay from an older tab.
New uploads require the updated client's protocol header, including retries of
older unconfirmed queue entries; their IDs and body hashes do not change. This
prevents an old tab from treating newly downloaded unfinished sessions as deleted.
Account/session checks still provide authorization; the header is only a version
compatibility check. A device handoff additionally requires a fresh base version.
