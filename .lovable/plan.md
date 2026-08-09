# Maps key on the deployed URL + verification pass

## What I checked

- `.env` already contains `VITE_GOOGLE_MAPS_KEY` with a value, and it is read in `LiveVisitorMap.tsx` via `import.meta.env`. Because `VITE_*` values are baked in at build time, this key is what the published site uses.
- Project secrets contain `GOOGLE_API_KEY` (backend-only) and the managed `LOVABLE_API_KEY`. A backend secret cannot be read by browser code, so adding `VITE_GOOGLE_MAPS_KEY` as a backend secret would not reach the map — the client value has to live in `.env`.

So the map key is present. If the deployed map is blank, the cause is almost certainly the key's HTTP-referrer allowlist, not a missing variable.

## Proposed work

1. **Point the client at the key you want.** Set `VITE_GOOGLE_MAPS_KEY` in `.env` to the value of your `GOOGLE_API_KEY` so both sides use one key. (Note: a `VITE_` value ships in the browser bundle by design; Google keys are protected by referrer restrictions, not secrecy.)
2. **Referrer allowlist (you, in Google Cloud Console).** The key must allow:
   - `https://intellitrap-batch-3.lovable.app/*`
   - `https://*.lovable.app/*` (covers preview URLs)
   and must have **Maps JavaScript API** enabled with billing active on the project. Without this the map renders blank / AUTH_FAILURE regardless of code.
3. **Alternative I recommend:** connect the Google Maps Platform connector instead, and read `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` in `LiveVisitorMap.tsx` with a fallback to the current variable. The managed key is pre-allowed on `*.lovable.app`, so the deployed map works with no console setup. It would not cover a custom domain later.
4. **Automated verification of what I can test** against the running preview: `/share` password path with a freshly created salted hash, 4 wrong attempts routing to honeypot, analytics page showing the 3 charts, and Ctrl+Shift+P presentation mode. I will report screenshots/results.

## Left to you (needs a real session/device)

- Delete the old BIOLOCK file and re-upload with password `Demo@123` (old rows carry pre-salt hashes).
- Phone-on-mobile-data dot appearing on the map.
- Removing "Phase Three Tester" from `/admin/dashboard` (destructive — I will not do it for you).

## Decision I need

Whether to go with step 1 (your own key + you fix the allowlist) or step 3 (managed connector key, no console work).

No changes to auth, sidebar, landing page, tracking, or the admin users table.
