# Day 24: hosted app and production configuration

The app uses one Vercel Services project for the Vite frontend and Express API,
plus a Neon PostgreSQL database. Both browser pages and `/api` use the same HTTPS
origin, preserving first-party Safari cookies and the existing relative API URLs.
Services is currently in beta on all Vercel plans; see the
[official Services documentation](https://vercel.com/docs/services).

## Selected resources

- Vercel project: `strength-training-app`, on the existing Hobby account.
- Neon database: `strength-training-db`, Free plan, Singapore region.
- Main address: <https://strength-training-app-six.vercel.app>.
- Additional verified alias: <https://strength-training-app-xtremecoc2112-2922.vercel.app>.

The installed Neon plan reports `paymentMethodRequired: false`. Its current
allowance is 1 GB per project and 100 CU-hours per project per month. Vercel Hobby
is for personal, non-commercial projects. Free allowances can change; check
[Neon pricing](https://neon.com/pricing) and
[Vercel Hobby](https://vercel.com/docs/plans/hobby) before changing plans or usage.
No paid plan, card details, domain purchase, or extra database branches were added.

## Production behavior

`vercel.json` routes `/api/:path*` to the Express service and everything else to
the frontend. Node 22 is pinned in both packages and the hosting project.
Install commands include development dependencies because TypeScript and Vite
are build tools, even when `NODE_ENV=production`.

The API service typechecks, then Vercel compiles its explicit `src/index.ts`
entry point with `outputDirectory: "."`. This avoids the service builder treating
compiled `dist` files as a separate CommonJS root; see the
[upstream packaging issue](https://github.com/vercel/vercel/issues/17651).
Local `npm run build` and the loopback `src/server.ts` entry point still work.

Production requires a separate authentication secret, exact public HTTPS
`APP_ORIGINS`, and `DATABASE_URL`. Hosted database connections verify the TLS
certificate. The normal URL can use Neon's pooler; migrations use the direct
`DATABASE_URL_UNPOOLED` URL so advisory locks keep the same connection.

Authentication limits use PostgreSQL in production, sharing counters between
function instances. The app trusts Vercel's overwritten client-IP header only
when running on Vercel, and overwrites the internal identity header itself.
Secure, HttpOnly, SameSite=Lax account cookies stay scoped to `/api`.

Neon credentials and the production auth secret are stored as production-only
secrets. Preview and development deployments do not receive production database
credentials. Private files, local PostgreSQL, dependencies, tests, and certificates
are excluded from source uploads. API responses use `no-store`; worker/manifest
headers prevent stale deployment metadata. Basic browser security headers are set.

## Existing data

With the user's explicit approval, the existing server account was copied to
Neon, retaining its ID and password hash. There were no server-saved workouts at
the time of the copy. Existing local database data was preserved; old browser
sessions were not copied and the hosted app requires sign-in.

IndexedDB belongs to an origin. Phone-only workouts at the old Mac address have
not moved to the new website. Keep the old Home Screen installation and website
data until those workouts have been transferred. No browser data was cleared.

## Updating the hosted version

This first release uploads the reviewed source directly through the connected
Vercel deployment API. GitHub is not connected to automatic deployments yet;
pushing a commit by itself does not update the hosted site.

A future manual release from the repository can use the Vercel CLI:

```sh
npx vercel@65.4.0 login
npx vercel@65.4.0 link --project strength-training-app --scope xtremecoc2112-2922
npx vercel@65.4.0 deploy --prod --skip-domain --scope xtremecoc2112-2922
# Verify the returned production build before publishing its aliases:
npx vercel@65.4.0 promote <verified-deployment-url> --scope xtremecoc2112-2922
```

Run the Day 22 regression suite before releasing changes. Schema changes need
reviewed additive migrations, applied through a private direct database connection
before releasing code that needs them. Never give preview builds production
credentials or put secrets in `VITE_*` variables.

Deployment verification results are recorded in [Day 25](day-25.md).
