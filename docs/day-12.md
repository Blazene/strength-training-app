# Day 12: app caching and PWA verification

App caching was added early at Day 7. This milestone hardens that implementation
and verifies it with the current logger and history screens.

- Ready for offline use checks the current page's required cached files, rather
  than treating a registered worker as proof that the app is cached.
- Cache status comes from the active worker. A waiting update's separate cache
  cannot hide missing files in the active version.
- Retry offline setup can refill missing app files without changing IndexedDB
  workouts.
- Navigation falls back to the cached app after two seconds on a stalled
  connection. A cache write failure does not discard a valid online response.
- API routes remain outside the app cache. Updates wait for training tabs to close
  so they do not force-reload an unfinished set.
- The offline panel includes a collapsible iPhone installation guide.

The existing manifest, standalone mode, touch icon, and 192/512 pixel install
icons are retained. Development hot reload still runs without the offline worker.

## Verify locally

In the **Frontend terminal**, stop a running production preview with Control + C:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run build
npm run preview -- --host localhost --port 5173 --strictPort
```

Expected: a successful build and `http://localhost:5173/`. Open that exact URL and
wait for Ready for offline use. Save a set, stop the preview server, and reopen the
same URL. The saved set and app screens should remain available. If an update is
waiting, save drafts, close all training tabs, and reopen.
