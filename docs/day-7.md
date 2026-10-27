# Day 7: reopen and train offline

The built app now caches its screens, scripts, styles, and install icons. Open it
once while connected and wait for **Ready for offline use**. You can then reopen
or refresh the same URL without a connection, log sets, finish workouts, and view
history. Workouts still save to IndexedDB on this device; cloud sync comes later.

The browser can install the app using its install or Add to Home Screen command
where supported. The app includes a standalone manifest, 192/512 pixel icons,
and an Apple touch icon. Remote hosting will require HTTPS. Localhost works for
local testing. Browser installation availability varies by platform.

## Use offline mode locally

Offline caching runs in the production build. The development server keeps normal
hot reload and displays **Offline launch is available in the built app**.

To try offline mode without changing where your existing workouts are stored:

1. In your **Frontend terminal**, stop the running dev server with **Control + C**.
2. In that same terminal, run:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run build
npm run preview -- --host localhost --port 5173 --strictPort
```

Expected: a successful Vite build, then `http://localhost:5173/`.
Leave this terminal running for the first visit. Open that exact URL and wait for
**Ready for offline use**. You can then disconnect, stop the preview server, and
refresh or reopen the app in the same browser. It should continue to work from
its cache. Installation is optional for offline browser access.

Always use the same host and port: `localhost:5173` and `127.0.0.1:5173` store data
separately. Clearing browser site data removes saved workouts and offline access.
Unsubmitted form inputs are still temporary.

To return to development, stop the preview server with Control + C and run in
the **Frontend terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run dev
```

Reload while connected. The app unregisters its offline worker when served by the
dev server so that hot reload works normally.

## Saving and updates

The offline panel shows readiness, the browser's reported connection state, and
setup failures with a retry button. An offline setup failure does not block normal
workout logging. The connection indicator does not claim that data has synced.

Each build generates a worker and cache name from its actual app assets. Updates
are downloaded in the background and wait until existing app tabs close. They do
not force a reload or discard unfinished form inputs. Close all training tabs and
reopen to activate a waiting update. Only this app's old shell caches are removed;
IndexedDB workouts are left intact. API requests are never served from this cache.

## Verification

Run in a **free terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm test
npm run lint
npm run build
```

Expected: five passing lookup tests, no lint errors, and a successful build that
includes `dist/sw.js`.

Browser checks cover caching of the full build, manifest/icon loading, offline
reload after stopping the server, logging/finishing offline, fresh-tab reopening,
previous-session references offline, update safety, API cache exclusion, and
failed offline setup with successful retry, browser installability diagnostics, and
switching back to the development server.

Implementation references: [service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
and [manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).
