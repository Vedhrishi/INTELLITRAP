# Verify and harden the live visitor map

## Status right now

The Google Maps key is present in the environment. I could not verify the map renders because the dashboard is behind auth and the sandbox has no signed-in session, so the map component never mounted.

One likely blocker found by reading `LiveVisitorMap.tsx`: the map is created with `mapId="intellitrap-dark-map"` and all markers use `AdvancedMarker`. A map ID must be created in the Google Cloud console; if that ID does not exist on your account, Google refuses to initialise the map and the panel renders blank (console shows an invalid-map-ID error) even though the key is valid.

## What to change

1. Drop the hardcoded `mapId` and switch markers from `AdvancedMarker` to the classic marker so the map works with any valid key and no console setup. Keep the dark styling via the `colorScheme` option (no map ID needed).
   - Protected-zone pulse ring and risk-coloured visitor dots are recreated with marker icons plus an overlay, so the visual result stays the same: risk colours, solid = online, faded = ended, Hyderabad protected zone, InfoWindow on click.
2. Add a visible failure state: if the Maps script fails to load or is rejected (referrer/API restriction), show a short message in the map panel naming the cause instead of an empty box.
3. Leave filters, legend, empty-state overlay, dashboard wiring, tracking, drawer, and event feed untouched.

## Verification

- Sign in on the preview once so I have a session, then I load `/dashboard` in a browser, confirm map tiles render, markers appear at visitor coordinates, clicking a marker opens the info window, and the console is free of Maps errors. Screenshot as evidence.

## Notes

Key restrictions to check on your side: the key needs Maps JavaScript API enabled, and its HTTP-referrer allowlist must include both the preview domain (`*.lovable.app`) and any custom domain, otherwise Google returns a referrer error regardless of the code.
