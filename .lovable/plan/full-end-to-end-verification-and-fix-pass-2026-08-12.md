# Full end-to-end verification and fix pass

Goal: drive the real app in a browser, click every interactive control on every screen, and fix anything that does nothing, errors, or shows a dead end — until every button produces a visible result.

## How verification runs

Automated browser session against the running app, signed in as the admin account. For each screen: click every button/toggle/tab/row action, capture console errors, network failures and screenshots, and record one of `works` / `no visible result` / `error`.

## Screens and controls to exercise

1. Landing `/` — hero CTAs, nav links, theme toggle, footer links.
2. Auth `/auth`, `/auth/forgot`, `/auth/reset` — login, register, validation errors, forgot-password send, password visibility toggle.
3. Dashboard — KPI cards, realtime status pill, map (zoom, marker click, drawer), live event feed, first-run banner copy button, presentation mode shortcut.
4. Visitors / Threats / Honeypot / Blocked IPs — filters, search, row click → drawer, release-from-trap, escalate-to-block, lift block, manual block dialog.
5. Files — upload dialog (file pick, password, one-time, expiry), share info dialog + copy, download, delete confirm, storage tab, download-log tab.
6. Settings — profile save, secret code reveal/copy/regenerate confirm, theme, session timeout.
7. Admin — dashboard, threat intel (block/whitelist actions, ML panel), audit log (filters, export), settings tabs (platform toggles + Save All, thresholds, IP rules), users table (status change, remove-user dialog).
8. Share `/share` — full state machine in a clean incognito session: code entry, wrong password, correct password → real download, challenge path, honeypot path (decoy downloads), blocked page.

## Fix policy

Every defect found is fixed in the same pass, smallest change first:
- Button with no handler or no feedback → wire the action and add a toast/optimistic UI.
- Silent failure → surface the error via toast and log it server-side.
- Dead-end state → add empty state or navigation out.
- Missing confirmation on destructive action → add confirm dialog.

Auth flow, sidebar structure, tracking pipeline and the risk engine are only touched if a control there is actually broken.

## Known items to close in this pass

- `admin_audit_log` has zero rows: exercise lift-block, manual block and settings save so the Audit Log screen has real data.
- Map pulse animation ignores `prefers-reduced-motion` (cosmetic, low priority).

## Exit criteria

- Every control listed above produces a visible, correct result.
- Zero console errors and zero failed network requests during the walkthrough.
- `/share` completes all four verdict paths.
- Typecheck and lint clean.
- Final report: screen-by-screen control inventory with pass status and a list of anything intentionally left as-is.

## Technical notes

Verification is scripted with Playwright against `localhost:8080`, restoring the injected Supabase session for authenticated screens and using a fresh context for the public `/share` and `/blocked` routes. Findings are gathered first, then fixes applied in batches by area (share flow, admin actions, files, dashboard), re-running the walkthrough for the touched areas after each batch.
