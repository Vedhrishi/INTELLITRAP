# IntelliTrap — Production Readiness Audit (read-only)

No files were changed. Findings come from reading source, database policies, and live table data.

## PART A — LOCATION TRACKING DIAGNOSIS

A1  PASS    — `TrackingProvider` is defined in `src/components/tracking/tracking-provider.tsx` and wraps `<Outlet/>` inside `src/routes/__root.tsx:127`, i.e. ALL routes including the public `/share` and `/blocked`.
A2  PASS    — Route changes are detected with `useRouterState({ select: s => s.location.pathname })` and a `useEffect` keyed on `pathname` (tracking-provider.tsx:54, 76-111); one call per navigation, with a `cancelled` guard.
A3  PASS    — It calls `trackVisitor` from `src/lib/tracking/tracking.functions.ts:81`, a real `createServerFn({method:"POST"})`, invoked at tracking-provider.tsx:81.
A4  PASS    — `clientIp()` in `src/lib/tracking/tracking.server.ts:28` reads `x-forwarded-for` (first hop), then `cf-connecting-ip`, then `x-real-ip`, falling back to `0.0.0.0`. Live data confirms real IPs are landing: 42 visitor rows with public IPv6/IPv4 addresses, only one `0.0.0.0` row.
A5  PARTIAL — Geo comes from `http://ip-api.com/json/...` (tracking.server.ts:44), plain HTTP. This runs server-side in the worker, so no browser mixed-content block applies, but it is unencrypted and free-tier rate-limited (45 req/min per server IP), and the whole call is wrapped in `try/catch` returning `{}` silently (line 65-67). Private/loopback IPs return `{}` immediately (line 42), so localhost sessions always have null coordinates.
A6  PASS    — Writes go to `public.visitors` via `supabaseAdmin` (service role) with `...geo` spread into the payload, so `latitude`/`longitude` are included when present (tracking.functions.ts:106-155). The write is NOT conditional on geo succeeding; a failed lookup simply leaves those columns null. RLS is irrelevant here because the service-role client bypasses it. Live data: 39 of 42 rows have coordinates.
A7  PARTIAL — `visitorHeartbeat` fires every 15s (`HEARTBEAT_MS = 15_000`, tracking-provider.tsx:51,114-122) for ALL visitors including anonymous ones on `/share`, and the interval is cleared on unmount. It updates only `is_online`, `last_heartbeat`, `current_page` and behavioural counters — never location fields (tracking.functions.ts:200-229).
A8  BROKEN  — Nothing ever sets `is_online = false`. There is no `beforeunload`, `pagehide`, or `visibilitychange` handler anywhere in `src`, and no server-side sweeper. All 42 rows in the database currently have `is_online = true`. The read side partly compensates: `fetchDashboardStats`/`fetchOnlineVisitors` add `.gt("last_heartbeat", freshHeartbeatIso())` (60s window, dashboard-data.ts:35,103-116) and `isOnline()` re-checks freshness client-side — but the map's marker styling relies on the same helper, so stale rows only fall offline via the heartbeat window, never on tab close.
A9  PARTIAL — `fetchMapVisitors` (dashboard-data.ts:96-105) selects `*` from `visitors` with `.not("latitude","is",null).not("longitude","is",null)`, limit 300. So rows without geo (3 today, plus every localhost session) never reach the map. More importantly, the query runs through the **browser anon/user client**, and the only SELECT policy on `visitors` is `staff read visitors USING private.is_staff()`. A signed-in user without the `admin`/`analyst` role gets zero rows with no error.
A10 PASS    — `useRealtimeTables` (`src/hooks/use-realtime.ts`) opens one channel for `visitors, visitor_events, blocked_ips, honeypot_activity` on the dashboard (dashboard.tsx:79-82), invalidates the four queries on change, and always calls `supabase.removeChannel` in cleanup. `visitors` IS in the `supabase_realtime` publication (confirmed: visitors, visitor_events, ip_intelligence, blocked_ips, honeypot_activity, file_access_log). Realtime also delivers only rows the subscriber may SELECT, so the same role restriction applies.

A11 ROOT CAUSE: Tracking itself is healthy — the server function is called on every navigation, the IP is read from real proxy headers, geo resolves, and 42 visitor rows with 39 sets of coordinates are in the database right now. The break is on the READ side: `visitors`, `visitor_events`, `ip_intelligence`, `blocked_ips` and `honeypot_activity` all have a single SELECT policy gated on `private.is_staff()`, and only one account in the project (`vedhrishi54@gmail.com`) holds the `admin` role. Every other signed-in account — including any fresh demo account created on stage — sees an empty map, an empty visitors table, and zero-value KPIs, with no error message, because RLS returns an empty set rather than a failure. Ranked severity: (1) staff-only RLS + single admin account = the reported symptom; (2) `is_online` never set false, so "who's online" only decays after the 60s heartbeat window and stale sessions linger; (3) the map's hard non-null latitude/longitude filter silently hides any session whose geo lookup failed or was rate-limited; (4) plain-HTTP, unauthenticated, rate-limited geo provider with a silent catch.

MINIMUM FIX: Grant the `analyst` (or `admin`) role to whichever account will be signed in during the demo — a single `user_roles` insert — or, if visitor telemetry is meant to be visible to every signed-in user, replace the `is_staff()` SELECT policies on the monitoring tables with an `authenticated`-scoped read policy. Secondary, in order: add a `pagehide`/`visibilitychange` beacon (or a server-side staleness sweep) that flips `is_online` to false; surface a "no located visitors yet" hint that distinguishes "no permission" from "no rows"; and move geo lookups to an HTTPS provider or cache results per IP in `ip_intelligence` to avoid the free-tier rate limit.

## PART B — AUTHENTICATION

B1  PARTIAL — `registerSchema` (src/lib/auth/auth-schemas.ts:23-38) enforces ≥8 chars, name, matching confirm and terms, but only 3 of the 4 character rules, so a symbol is optional; `PasswordStrength` renders the 4-segment meter (register-form.tsx:84).
B2  MISSING — Email auto-confirm is enabled and `ProtectedRoute` only checks for a session; no route or guard inspects `email_confirmed_at`.
B3  PASS    — All auth failures route through `humanAuthError` (src/lib/auth/auth-errors.ts); no raw backend text reaches the UI.
B4  PASS    — `/auth/forgot` calls `resetPasswordForEmail` with a redirect to `/auth/reset`, which completes the recovery token flow.
B5  MISSING — No `signInWithOAuth` or `lovable.auth.signInWithOAuth` call exists anywhere in `src`.
B6  PASS    — Supabase persists the session in localStorage and `AuthProvider` rehydrates via `getSession` + `onAuthStateChange`.
B7  PASS    — `src/components/session/session-timeout.tsx:15-16` warns at 25 min and signs out at 30 min of inactivity, checking every 60s, listeners cleaned up.
B8  PASS    — `ProtectedRoute` redirects to `/auth`; the whole `_authenticated` subtree is `ssr:false` (routes/_authenticated/route.tsx:10).
B9  PASS    — Enforced server-side in two independent layers: `removeUserAccount` (src/lib/admin/admin.functions.ts:18-40) re-verifies the caller's admin role before acting, and every admin-only table is RLS-gated on `private.is_admin()` / `private.is_staff()`.
B10 PARTIAL — Direct navigation to `/admin/*` as a non-admin is blocked by `RoleGuard` in `src/routes/_authenticated/admin.tsx`, which is a client-side check; the underlying data stays protected by RLS, so the exposure is cosmetic rather than a data leak.

## PART C — /share STATE MACHINE

C1  PASS — `createFileRoute("/share")` in `src/routes/share.tsx` is top-level, outside `_authenticated`, with no `beforeLoad` and no guard component.
C2  PASS — `findShareOwner` (tracking.functions.ts:419) resolves the code to a profile server-side.
C3  PASS — `ownerName` is rendered as "Files shared by {name}" and reused on the granted card.
C4  PASS — Wrong code triggers a shake animation plus inline error (share.tsx:523-530).
C5  PASS — Password step has a show/hide eye toggle.
C6  PASS — "N attempts remaining" derives from `failedAttempts` state and displays after the first failure.
C7  PASS — Both sides use the identical literal `intellitrap-salt-2024`: client `hashPassword` in `src/lib/share/format.ts:59-70` and server `hashSharePassword` in `src/lib/tracking/tracking.server.ts:176`.
C8  PASS — Fixed ~1.5s analyzing state with orbital rings and a 0→100% progress bar.
C9  PASS — `runRandomForest(features)` executes inside the analyzing effect (share.tsx:257).
C10 PASS — `verifyFilePassword` returns a 60-second signed URL (tracking.functions.ts:565).
C11 PASS — CAPTCHA first, then email OTP; three OTP failures silently switch to the honeypot state.
C12 PASS — Both branches render `AnimatedCheckmark`, the same gradient "Access Granted" heading, the same `FileCard` with "Shared by {owner}", and the same green `shimmer-btn` Download button (share.tsx:700-830). The only extra markup in the honeypot branch is the "Related files you may also need" list, which is the intended lure of C14, not a tell.
C13 PASS — `downloadDecoy` builds a real `Blob` and object URL from the generated template.
C14 PASS — Related-decoys list renders when `decoyItems.length > 1`.
C15 PASS — Blocked state is a full-screen `#0a0000` overlay with a drawn shield-X, no buttons, and only an opaque reference string.
C16 PASS — Download-complete shows the animated checkmark and an "Access another file" reset.

## PART D — RANDOM FOREST RISK ENGINE

D1  PASS — `src/lib/riskEngine.ts` exists.
D2  PASS — Exactly 15 tree functions (`grep -c "^function tree"` = 15) collected in the `TREES` array at line 182.
D3  PASS — Each tree keys off a distinct feature subset (auth failures, network, biometrics, UA, velocity, repeat offences, temporal, combined).
D4  PASS — Votes are tallied per decision and the highest count wins.
D5  PASS — Score is the vote-weighted average of decision scores, clamped 0–100.
D6  PASS — `levelForScore`: ≤30 low, ≤60 medium, ≤80 high, else critical.
D7  PASS — Decisions are exactly granted / captcha_mfa / honeypot / blocked.
D8  PASS — Confidence = winning votes ÷ 15, rendered as "N% model confidence".
D9  PASS — `buildFeatures` derives suspicious UA from a 17-agent list, off-hours IST, and requests/min.
D10 PASS — Requests/min is computed from stored `visitor_events.created_at` within a 60s window server-side (tracking.functions.ts:290-296); the client never supplies it.
D11 PASS — IST derived as `Date.now() + 5.5h` then `getUTCHours()` (tracking.server.ts:154).
D12 PASS — `breakdown` maps named factors to point values.
D13 PASS — Top three signals are computed and persisted with the verdict.
D14 PASS — `DECISION_SEVERITY[serverDecision] > DECISION_SEVERITY[forest.decision] ? serverDecision : forest.decision` (share.tsx:262-266) — the stricter of the two wins, so the client can only escalate, never downgrade the server verdict.

## PART E — HONEYPOT AND DECOYS

E1  PASS — `src/lib/decoyGenerator.ts` exists.
E2  PASS — Exactly the eight required categories are defined.
E3  PASS — Multiple file names per category, chosen at random.
E4  PASS — Realistic content templates with matching MIME types.
E5  PASS — Plausible randomised byte sizes per decoy.
E6  PASS — `generateDecoySet(3)` de-duplicates with a `used` Set (decoyGenerator.ts:243-256).
E7  PASS — Generation is pure client-side; the `decoy_file_templates` table is not required.
E8  PASS — Honeypot entry inserts into `honeypot_activity` from `applyRiskVerdict` (tracking.functions.ts:783).
E9  PASS — Each decoy download calls `logHoneypotAction` with the file name plus a `file_download_decoy` visitor event.
E10 PASS — `/honeypot` and the admin `HoneypotPanel` list active trap sessions.
E11 PASS — `TrapTimer` counts up per active card and clears its interval on unmount.
E12 PASS — Escalate-to-block and release actions are wired to real writes.

## PART F — AUTOMATIC BLOCKING

F1  PASS    — A `blocked` verdict upserts a persisted row into `blocked_ips` on `ip_address`.
F2  PASS    — The write happens inside `applyRiskVerdict` using `supabaseAdmin` (service role), loaded with `await import("@/integrations/supabase/client.server")` inside the handler. The browser anon client cannot insert: the only INSERT policy on `blocked_ips` is `admin inserts blocks` for `authenticated`.
F3  PASS    — Stores IP, trigger score, trigger signals, geo snapshot, device snapshot, `block_type`, and `blocked_at`.
F4  PASS    — `trackVisitor` calls `isIpBlocked` before doing anything else on every navigation.
F5  PASS    — The provider navigates to `/blocked` when `result.blocked` is true (tracking-provider.tsx:96-98).
F6  PASS    — `/blocked-ips` lists all blocks for staff.
F7  PASS    — `block_type` is written as `auto` or `manual` at the two call sites.
F8  PARTIAL — `liftBlock` sets `is_active=false` with `unblocked_at`/`unblocked_by`, but no `admin_audit_log` row is written; the only audit insert in the codebase is in `src/lib/admin/admin.functions.ts:74`.
F9  PASS    — Manual "Block IP" from the visitor drawer writes `block_type: "manual"`.

## PART G — GOOGLE MAPS

G1  PASS    — Dark theme comes from an inline `styles` array; `colorScheme` is not used anywhere in `LiveVisitorMap.tsx`.
G2  PASS    — `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` first, falling back to `VITE_GOOGLE_MAPS_KEY` (LiveVisitorMap.tsx:17-18). Both are present in `.env`.
G3  PASS    — Hyderabad zone at [17.385, 78.4867] with a 45 km `Circle` and ringed shield marker.
G4  PASS    — `riskColor()` maps `risk_level` to green/amber/orange/red.
G5  PARTIAL — Online dots are 20px at full opacity vs 14px at 0.5 opacity offline, but they are static SVG data-URI icons with no pulse ring.
G6  PASS    — Clicking a dot opens an InfoWindow with IP, city, ISP, device, risk and decision.
G7  PASS    — "Click to view full profile" invokes `onSelect`, opening the visitor drawer.
G8  PASS    — All / Online Now / High Risk / India Only filters are applied in a `useMemo`.
G9  PASS    — Legend pinned bottom-left with the four risk colours.
G10 PASS    — `EmptyOverlay` renders on top of a still-live map that keeps the Hyderabad marker.
G11 PASS    — `LoadFailure` panel renders on `APILoadingStatus` failure and when the key is missing; the dashboard keeps rendering.
G12 PARTIAL — `map-visitors` polls every 30s (dashboard.tsx:60); the realtime channel does invalidate it, so push updates work when the subscriber has SELECT rights, but a non-staff viewer gets neither.
G13 PASS    — Confirmed: the map query requires non-null latitude AND longitude (dashboard-data.ts:99-100). Cross-referencing A5/A6 — 3 of 42 current rows have no coordinates and are invisible, and every localhost/private-IP session will be invisible by construction.

## PART H — ADMIN SYSTEM

H1  PASS    — Pulsing red "ADMIN MODE" pill in `src/components/layout/top-bar.tsx`.
H2  PASS    — Gold crown beside the admin name in `user-menu.tsx`.
H3  PASS    — Admin sidebar gets a dark red top border via `adminAccent` (app-layout.tsx:16).
H4  PASS    — Exactly six KPI cards on `/admin/dashboard`.
H5  PASS    — `AdminEventStream` refreshes on `useRealtimeTables(["visitor_events","visitors","blocked_ips"])`.
H6  PASS    — `UsersTable` lists all profiles (readable by admins under the profiles policy).
H7  PASS    — Removal requires typing `CONFIRM REMOVE` in `remove-user-dialog.tsx`.
H8  PASS    — `removeUserAccount` runs server-side and calls `supabaseAdmin.auth.admin.deleteUser(data.userId)` (admin.functions.ts:88) — it genuinely deletes the auth user, not just a profile flag.
H9  PASS    — Admin targets are rejected both in the dialog and inside the server function.
H10 PASS    — Optional file deletion removes storage objects via `supabaseAdmin.storage.from("user-files").remove(paths)` (line 55) and then the `files` rows.
H11 PASS    — The ban-IP option writes a real `blocked_ips` row.
H12 PASS    — The dialog surfaces the thrown error's message, not a generic string.
H13 PASS    — `/admin/threat-intel` renders LiveAccessMonitor, MlAnalysisPanel, HoneypotPanel, AutoBlocksTable and RiskSignalChart.
H14 PASS    — `audit-log-table.tsx` is read-only; the table has DELETE and UPDATE denied at the policy level too.
H15 PARTIAL — Audit rows are written for user removal only; lift-block, manual block, and settings changes do not insert into `admin_audit_log`.
H16 PASS    — Platform, thresholds and IP-rules tabs persist through `upsertPlatformSettings` / `detection_rules` / `ip_intelligence` writes.

## PART I — FILES AND STORAGE

I1  PASS    — Drag-and-drop with an active drop state in `upload-dialog.tsx`.
I2  PASS    — `BLOCKED_EXTENSIONS` in `src/components/files/types.ts` blocks .exe .sh .bat .msi .cmd .vbs .ps1 .jar.
I3  PASS    — Sharing toggle with password + confirm fields.
I4  PASS    — Strength meter on the share password.
I5  PASS    — One-time download writes `one_time`.
I6  PASS    — Never / 24h / 7d / 30d expiry mapped to `expires_at`.
I7  PASS    — Post-upload modal is gated behind a "I've saved this password" checkbox.
I8  PARTIAL — There is no generation in `handle_new_user`, so `user_secret_code` starts null for every account. It is backfilled lazily only when the user opens the Settings → Secret Code tab (settings.tsx:176-182). A user who never visits Settings keeps a null code, and nothing on the files or share flow triggers the backfill.
I9  PASS    — Code chip with copy button in the account dropdown.
I10 PASS    — `QRCodeSVG` of the share URL.
I11 PASS    — Regeneration requires typing `REGENERATE` and rewrites profile + file references.
I12 PASS    — `computeFileStatus` yields Active / Expired / Consumed / Revoked / Private.
I13 PASS    — Per-file Revoke sets `share_revoked` behind a confirm dialog.
I14 PASS    — Download Log reads real `file_access_log` rows for the owner's files.
I15 PASS    — Storage bar: blue < 50%, amber < 80%, red above.
I16 PASS    — Amber warning card above 90% usage.
I17 PARTIAL — Byte quota is enforced twice (client check plus the `enforce_quota` BEFORE INSERT trigger raising `STORAGE_QUOTA_EXCEEDED`), but the 100-file cap is only checked in the browser (upload-dialog.tsx:143) — no database constraint backs it.

## PART J — ANALYTICS AND MONITORING

J1  PASS — Four KPI cards: sessions tracked, online now, high risk, in honeypot.
J2  PASS — Risk signal frequency chart from `fetchTodaySignalFrequency`.
J3  PASS — Risk distribution pie computed from fetched visitor rows.
J4  PASS — Top source cities bar chart from real `visitors.city` values.
J5  PASS — Access decisions bar chart from real `access_decision` values.
J6  PASS — No hardcoded data arrays feed any chart; every series is derived from a `useQuery` result. Only colour maps are constants.
J7  PASS — Each chart has a "No data yet" fallback.
J8  PASS — `/visitors` lists sessions with `useRealtimeTables(["visitors"])`.
J9  PASS — `/threats` filters to high and critical.
J10 PASS — `/honeypot` shows active traps.
J11 PASS — `/blocked-ips` lists blocks with a working lift action.

## PART K — REALTIME AND PERFORMANCE

K1  PASS — Six subscription sites, all through the single `useRealtimeTables` hook: `dashboard.tsx:79`, `visitors.tsx:48`, `threats.tsx:49`, `honeypot.tsx:39`, `admin.dashboard.tsx:60`, `admin.threat-intel.tsx:86`.
K2  PASS — All six share the hook's `return () => { void supabase.removeChannel(channel) }` cleanup (use-realtime.ts:38-40).
K3  PASS — No duplicates: only one monitoring page mounts at a time, and each channel name is derived from its table list, so no two live channels collide.
K4  PASS — Polling is all `refetchInterval` on TanStack Query (self-cleaning); the two manual `setInterval`s (heartbeat, session timeout) both clear in their effect cleanup.
K5  PASS — `behaviorTracker.start()` / `.stop()` pair in a mount-once effect (tracking-provider.tsx:65-73).
K6  PASS — `window.clearInterval(interval)` on unmount and on any change of session/page/blocked (tracking-provider.tsx:121).
K7  PASS — No uncleaned listener or interval found; `useCountUp` also cancels its animation frame.

## PART L — SECURITY AUDIT

L1  PASS    — No service-role key in client code; `supabaseAdmin` lives in `client.server.ts` and is only ever `await import`-ed inside server-function handlers.
L2  PASS    — `visitors`, `visitor_events`, `honeypot_activity`, `ip_intelligence` and `blocked_ips` all deny INSERT/UPDATE/DELETE to the anon and authenticated clients (blocked_ips allows INSERT only to admins); every telemetry write goes through a server function.
L3  PARTIAL — `RoleGuard` in `admin.tsx` is browser-side. Data access is still RLS-enforced and `removeUserAccount` re-verifies the role, so no privileged action rides on the client check alone — but admin *chrome* is client-gated.
L4  PARTIAL — The client cannot lower the server verdict (D14), but the honeypot/granted branch itself is client state, and `verifyFilePassword` issues a real signed URL whenever the password hash matches, without consulting the stored risk decision. A tampered client that already knows the correct password could force the granted branch and pull the real file. The deception layer, not the file's access control, is what an attacker can bypass.
L5  PASS    — IP is always read from request headers server-side; no client-supplied IP field is accepted by any validator.
L6  PASS    — Zero `console.log` / `console.debug` occurrences in `src`.
L7  PARTIAL — `SecurityAnalysisPanel` renders the full breakdown, tree votes, confidence and top signals to the visitor being scored — including a trapped attacker, who learns exactly which signals fired. Intentional for the demo, but it is detection logic disclosure.
L8  PASS    — Real downloads use a 60-second `createSignedUrl` (tracking.functions.ts:565).
L9  PASS    — No `dangerouslySetInnerHTML` on user-controlled data; decoy content is delivered as a Blob, never injected into the DOM.
L10 PARTIAL — Guards are client-side by design on this stack (`_authenticated` is `ssr:false`), so a direct URL momentarily renders the shell before redirecting; the data behind it stays RLS-protected.

## PART M — POLISH AND ACCESSIBILITY

M1  PASS    — Ctrl+Shift+P handled in `routes/_authenticated/route.tsx:19-27`.
M2  PASS    — Zustand `persist` stores the flag under `it_presentation_mode`.
M3  PASS    — `FirstRunBanner` shows when today's count and located visitors are both zero (dashboard.tsx:128).
M4  PASS    — `AnimatePresence` drives every `/share` state transition.
M5  PASS    — `AnimatedCheckmark` used in both granted and honeypot.
M6  PASS    — Skeletons on dashboard, admin, analytics, files and threat-intel panels.
M7  PASS    — Empty states on tables, charts and the map overlay.
M8  PARTIAL — Boundaries exist at the root (`errorComponent` in `__root.tsx:103`) and around the authenticated outlet (`DashboardErrorBoundary`), but not per individual route.
M9  PARTIAL — The sidebar collapses to a sheet at 768px (`MOBILE_BREAKPOINT = 768` in `src/hooks/use-mobile.tsx`), not 1024px, so tablets keep the full sidebar.
M10 PASS    — `DataTable` wraps in an `overflow-x-auto` container.
M11 PASS    — The map is height-fixed and width-fluid; filter pills wrap.
M12 PASS    — `toIST` / `toISTTime` used for displayed timestamps.
M13 PASS    — Dark tokens throughout; no white-background surfaces found.
M14 PASS    — shadcn primitives retain focus rings; interactive markers and pills are real buttons.
M15 PASS    — `@media (prefers-reduced-motion: reduce)` block at `src/styles.css:220`.
M16 PASS    — `tsgo --noEmit` exits clean with no output.
M17 PASS    — No `console.log` in any production path.

## SUMMARY

Items audited:   162
PASS:            142
PARTIAL:         17
MISSING:         2
BROKEN:          1

### CRITICAL BLOCKERS

- A9 / A11 — Any demo account without the `admin` or `analyst` role sees an empty map, empty visitors table and zero KPIs. Only `vedhrishi54@gmail.com` currently holds `admin`. This is the reported "location tracking not updating" symptom and it will reproduce on stage if you sign in with a fresh account.
- A8 — Closing a tab never marks a session offline, so "Online now" stays inflated until the 60-second heartbeat window expires, and the visitors list keeps showing green dots for people who have left.
- G13 — The map hides any visitor with null coordinates; a geo-lookup rate limit (free ip-api tier, 45/min per server IP) during a live demo would silently empty the map.
- B2 / B5 — No email verification gate and no Google sign-in; both are visible gaps if the panel asks about the auth story.

### SECURITY FINDINGS

- L4 (medium) — The honeypot/real-file branch is decided client-side; the server issues a real signed URL on any correct password, so the deception layer is bypassable by a tampered client that already has the password.
- L7 (low-medium) — Full detection breakdown, tree votes and fired signals are shown to the visitor being scored, including trapped attackers.
- L3 / L10 (low) — Admin chrome and route access are gated in the browser; the data behind them is RLS-protected, so the impact is cosmetic.
- F8 / H15 (low) — Lift-block, manual block and settings changes are not written to `admin_audit_log`, weakening the "every privileged action is audited" claim.

DEMO READINESS: 88/100

### RECOMMENDED FIX ORDER

1. Grant `analyst` (or `admin`) to the demo account, or relax the monitoring-table SELECT policies to all authenticated users — this alone resolves the reported bug. (small)
2. Mark sessions offline on `pagehide`/`visibilitychange`, or sweep stale rows server-side. (small)
3. Show a distinct "you don't have monitoring access" state instead of an empty map, so a permission problem never looks like a data problem again. (small)
4. Cache geo per IP in `ip_intelligence` and switch to an HTTPS provider, so rate limiting cannot empty the map mid-demo. (medium)
5. Re-check the stored risk decision inside `verifyFilePassword` before issuing a real signed URL, so the honeypot cannot be bypassed client-side. (medium)
6. Write `admin_audit_log` entries for lift-block, manual block and settings changes. (small)
7. Add a pulse ring to online map markers and drop the sidebar breakpoint to 1024px. (small)
8. Generate `user_secret_code` in `handle_new_user` so it is never null. (small)
9. Enforce the 100-file cap with a database constraint or trigger alongside the byte quota. (medium)
10. Add an email-verification gate and Google sign-in if the presentation claims them. (large)
