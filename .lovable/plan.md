# Six targeted fixes for the demo build

## What already exists (verified)

- Presentation mode already exists as a persisted store (`src/lib/presentation-mode.ts`) and is wired into the authenticated layout with a banner and a `presentation-mode` class on `<html>`. No Ctrl+Shift+P shortcut is registered anywhere yet.
- The honeypot panel already renders a live per-card `TrapTimer` ("In trap: Xs") with interval cleanup.
- The visitor drawer already lists the `risk_breakdown` factors with `+points`. It does not show `risk_signals`.
- The first-run banner exists but is only text + copy button, dismissed via `it_firstrun_dismissed`.

So instead of duplicating a second presentation-mode hook and a second trap timer, the plan extends what's there.

## 1. Google Maps dark theme without mapId

In `LiveVisitorMap.tsx`, drop `colorScheme="DARK"` and pass the slate dark `styles` array exactly as specified so the dark look works on any key tier. No other change in that file.

## 2. Presentation mode

Add the Ctrl+Shift+P keyboard shortcut to the existing presentation-mode store (toggles the same persisted flag, so it survives refresh) rather than creating a competing hook with its own localStorage key. Then on the dashboard:

- Enlarge the map to 600px when presentation mode is on (420px otherwise).
- Show the "Presentation Mode Active — Map enlarged for projector display" strip with the "Ctrl+Shift+P to toggle" hint above the KPI cards.
- Scale dashboard text up slightly while active.

## 3. Analytics charts

Add three recharts panels below the existing signal chart, in a responsive `lg:grid-cols-3` grid, all computed from the already-fetched visitor rows:

- Risk distribution pie (low/medium/high/critical, green→red).
- Top source cities bar chart (top 8 by count).
- Access decision breakdown bar (granted / challenged / honeypot / blocked).

Each panel gets a friendly empty state when its data array is empty.

## 4. Visitor drawer risk signals

Keep the existing factor breakdown, and add the `risk_signals` chips below it when the array is non-empty.

## 5. Honeypot timer

Already implemented per active card. Verify only, and make sure the timer renders for sessions still in the trap (entered, not exited) so nothing shows a stale counter.

## 6. First-run banner for the demo

Rewrite the banner content: pulsing radio icon, "Your threat detection system is armed", the explanation line, the URL block with a Copy button, the presentation guidance for panel members, and the Ctrl+Shift+P tip. Dismissal moves to the `it_banner_dismissed_v2` localStorage key. Render it on the dashboard when the visitor count is zero.

## Technical notes

- No new packages; recharts and framer-motion are already installed.
- All colors stay in the existing slate/blue palette used across the dashboard.
- Nothing in auth, share, tracking, admin user removal, sidebar, or the landing page is touched.
- Typecheck and lint run clean at the end.
