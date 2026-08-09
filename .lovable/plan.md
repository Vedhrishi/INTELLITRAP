# Option 3: managed Google Maps browser key

Confirmed in the code: `src/components/dashboard/LiveVisitorMap.tsx` line 17 currently reads only `VITE_GOOGLE_MAPS_KEY`, and `.env` holds a value for it.

## Change (one line, one file)

In `src/components/dashboard/LiveVisitorMap.tsx`, replace the key lookup with:

```ts
const MAPS_KEY = (
  import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] ||
  import.meta.env["VITE_GOOGLE_MAPS_KEY"]
) as string | undefined;
```

Nothing else in the file or any other file changes. The existing "key missing" fallback panel and the dark `styles` array stay as they are.

## Connector step

Open the Google Maps Platform connect card so the managed connection is linked to this project. Once linked, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` is injected automatically and takes priority over the existing key. The managed key is referrer-allowed on `*.lovable.app`, so the deployed and preview maps both work with no Google Cloud Console setup. (If a custom domain is added later, that domain needs its own key.)

## Verification

Typecheck for zero errors, then load the dashboard in the preview and confirm the map tiles render dark instead of showing the missing-key or load-failure panel.

## Not touched

Auth, sidebar, landing page, `/share`, tracking, admin users table.
