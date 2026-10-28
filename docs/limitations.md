# Known limitations and current status

As of 28 October 2026, the core app is deployed and automated Chromium/WebKit, database and hosted checks have passed. A real workout on the hosted version on the user's phone (Day 26) and the final demo/bug buffer (Day 28) remain unfinished. The earlier physical iPhone test passed against the local Mac preview on 27 October; it is a separate result.

## Data and browser storage

- Only logged/saved sets persist. Unfinished form fields and edits can be lost on reload or closing; save them first.
- IndexedDB and app caches belong to an origin and browser profile. Localhost, a Mac hostname, an IP address and the hosted URL have separate storage. Home Screen/Safari contexts may also differ; use the same installed app consistently.
- The phone-only history at the old Mac address has not transferred. The deployment copied one existing server account and zero server-saved workouts. Keep the old installation and website data until its local workouts have been transferred.
- Clearing website data, private browsing or browser/device storage eviction can remove local-only workouts. Browser storage and a service-worker cache are not guaranteed backups.
- There is no in-app workout export/import or automatic backup/restore feature. Server sync adds another stored copy after confirmation, but does not provide point-in-time backup protection against accidental synced deletion.

## Offline use and synchronization

- Make an initial online visit and wait for **Ready for offline use** before relying on reopening offline. Local storage alone does not cache the app files.
- **Saved on this device** does not mean **Synced to …**. Offline, retrying, expired-session, conflict and deferred-input states can all keep uploads/downloads pending.
- Sync needs connectivity while the app is open. Background work after the app is closed is not guaranteed or required by the implementation.
- One person should log from one device at a time. Sequential handoff is version-checked; simultaneous editing can require **Keep both versions** and manual review.
- A device's queue stays linked to its enabled account. Signing out or using another account preserves that ownership and pauses uploads. There is no in-app account-switch/reset workflow for moving already linked local data to a different owner.
- Completed workout deletion is permanent in the app and synchronizes to the server. Tombstones/receipts are retained to prevent stale requests restoring deleted data; there is no undo/trash screen.

## Accounts, scope and hosting

- Email/password login is supported. Email verification, password reset/recovery delivery, additional providers and account-management/delete UI are not implemented. Keep access to your password; this remains a personal-use first version.
- The library contains eight predefined exercises. Logging uses kilograms; custom exercises, unit conversion, advanced analytics, complex programs, nutrition, wearables, AI recommendations and social features are outside the current version.
- API limits are 256 KiB per request, 30 exercises per workout and 100 sets per exercise. These are enforced server-side.
- Vercel Services is in beta. Vercel Hobby and Neon Free have usage limits and provider availability constraints; the project has no independent uptime monitor or managed backup process. Check provider terms before changing its personal-use scope.
- The initial release was uploaded from reviewed local source. GitHub pushes do not automatically redeploy it. Follow the [manual release instructions](day-24.md#updating-the-hosted-version) when publishing code changes.

The current setup and architecture guides describe the implemented system. Individual `day-*.md` files are milestone records and can describe features that were still planned at that earlier date.
