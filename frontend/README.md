# Strength Training frontend

React + TypeScript + Vite client for the [Strength Training app](https://strength-training-app-six.vercel.app).

Start with the [project README](../README.md) and [local setup guide](../docs/setup.md). Install dependencies in both packages and configure PostgreSQL/the backend before using accounts or sync locally.

```sh
# From frontend/
npm ci
npm run dev
```

Open <http://localhost:5173/>. The dev server proxies `/api` to `http://127.0.0.1:4001`; `BACKEND_URL` can override that target. Keep the same browser origin to retain local workouts.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Hot reload; no production offline worker |
| `npm run build` | TypeScript check, Vite build and generated PWA shell |
| `npm run preview -- --host localhost --port 5173 --strictPort` | Serve the built app for local offline tests; stop dev first |
| `npm run phone` | Build and serve the Mac's same-Wi-Fi iPhone HTTPS preview |
| `npm test` | Frontend unit/helper checks |
| `npm run lint` | ESLint |
| `npm run test:e2e:install` | Install the pinned Playwright Chromium/WebKit engines |
| `npm run test:e2e` | Both apps' checks plus isolated PostgreSQL/browser regressions |

`src/storage/` handles IndexedDB state and atomic queue writes. `src/sync/` handles ownership, retries, downloads and merge decisions. `pwa/offlinePlugin.ts` emits the worker and app-shell manifest during a production build. Unfinished form fields stay in React state until saved.

See [architecture](../docs/architecture.md), [known limitations](../docs/limitations.md), and [test instructions](../docs/day-22.md). Do not put secrets or database credentials in `VITE_*` variables.
