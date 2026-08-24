# Fix visitor locations and the "NoSuchKey" share download

## What I confirmed first

- Every row in `visitors` has `latitude`, `longitude`, `city`, `country`, `isp`, `timezone` = NULL — including today's sessions on `/` and `/dashboard`. Device/browser fields are filled, so tracking itself runs on every page (mounted in `src/routes/__root.tsx`); only the geo enrichment returns nothing.
- The map query (`fetchMapVisitors` in `src/lib/tracking/dashboard-data.ts`) filters `latitude is not null`, so with no geo the map is always empty.
- The lookup provider itself is healthy: `https://ipwho.is/<ip>` returns Hyderabad/India for the exact IPv6 currently in the table. So the single-provider call in `src/lib/tracking/tracking.server.ts` is failing at runtime (swallowed by its `catch { return {} }`) with no visibility.
- The download error is a one-time-link bug: `verifyFilePassword` (`src/lib/tracking/tracking.functions.ts`) creates the signed URL and then **immediately deletes the stored object** for `one_time` files. The browser only fetches that URL when the user clicks Download, by which time the object is gone → `NoSuchKey`. The DB shows this exactly: `IMG_9699.pdf` is `consumed = true` with no matching object in storage.

## Fix 1 — Locations that actually resolve, on every page

- Replace the single geo call with a small provider chain in `tracking.server.ts`: `ipwho.is` → `ipapi.co` → `ip-api.com` (https), each with a short timeout; the first success wins. Keep per-IP caching in `ip_intelligence` so a resolved IP never re-hits a provider.
- Stop swallowing failures silently: log the provider status/reason server-side so the logs show why a lookup failed.
- Persist geo on heartbeats too, not just the first page view, so a visitor who lands unresolved gets filled in on the next beat instead of staying blank forever.
- Fall back to the browser-reported timezone/locale (already collected in the device fingerprint) for country/region when every provider fails, so the visitor is at least placed on the map instead of disappearing.
- One-off backfill of existing `visitors` / `ip_intelligence` rows that have an IP but no coordinates, so the map and Threat Intel pages are populated for the demo.

Note on precision: IP geolocation is city-level, not street-level — that is the ceiling for a visitor who has not granted browser location permission. If you want true GPS precision for signed-in users, say so and I will add an opt-in permission prompt as a follow-up.

## Fix 2 — Share download no longer 404s

- Remove the eager object deletion from `verifyFilePassword`. Verification marks the link used, but the file stays in storage so the signed URL still resolves when the visitor clicks Download.
- Add a `confirmShareDownload` server function the `/share` page calls after the download actually starts: it flags `consumed` / `share_revoked` and removes the object then.
- Before signing, confirm the object exists and handle the `createSignedUrl` error instead of returning a URL of `null`/dead path; on a missing object the page shows "This file is no longer available" rather than a raw storage error.
- Lengthen the signed-URL window from 60s to 5 minutes so a slow click doesn't expire the link.
- `src/routes/share.tsx`: call the confirm function in `downloadRealFile`, and surface the "no longer available" message in the existing error state.

## Technical notes

- Files touched: `src/lib/tracking/tracking.server.ts`, `src/lib/tracking/tracking.functions.ts`, `src/routes/share.tsx`, plus one backfill query. No schema change needed — all geo columns already exist.
- Not touched: auth, sidebar, landing page, risk engine, honeypot logic, admin users table.
- Verification: re-run the share flow end to end in a browser (upload with password → open `/share` → download real file bytes), and confirm `visitors` rows for `/` and `/dashboard` come back with city + coordinates and appear as markers on the dashboard map.
