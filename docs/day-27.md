# Day 27: project documentation and screenshots

Completed on 28 October 2026.

- Added a repository README with the live app, feature scope, screenshots, local start instructions, verification commands and documentation map.
- Added a fresh-clone setup guide covering PostgreSQL, the private environment file, migrations, frontend/API terminals, production preview, ports and troubleshooting.
- Documented the local-save transaction, account-bound sync queue, receipts, retries, downloads, version handoff, conflict recovery, service worker and API boundaries.
- Recorded current limits, origin-specific storage, unpersisted drafts, missing account recovery/export features, manual releases and remaining milestones.
- Replaced the default Vite frontend README with project-specific commands and links.
- Captured four mobile app screenshots using synthetic data and a disposable browser context, without modifying personal browser or server data.

Verification passed:

- All 34 local links, image references and referenced headings across the nine current Markdown guides resolve; code fences are balanced.
- All four screenshots were visually reviewed; the home capture includes its complete Start workout action.
- The documented PostgreSQL initialization, password-protected app role and owned database were exercised in a disposable cluster on a free port.
- A fresh backend copy generated a private environment file, applied migrations twice, typechecked and built successfully.
- The built API connected as the development app role: eight seeded exercises, three recorded migrations, database health 200 and the account endpoint 401 without a session.
- Temporary database/API processes and their files were removed; existing app services and data were preserved.

Day 26's hosted physical iPhone workout and Day 28's demo/final bug buffer remain open. The earlier Day 14 phone result and Day 25 automated hosted checks are preserved as separate evidence.
