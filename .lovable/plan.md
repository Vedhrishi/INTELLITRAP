# IntelliTrap — Full Application Audit (read-only)

No code was changed. Every finding below comes from reading the source, the database schema, and the function definitions.

## SECTION 1: AUTHENTICATION SYSTEM

1.1  PARTIAL — Register enforces min 8 chars and 3-of-4 rules (case/digit/symbol), so a special character is not strictly required.
1.2  PASS   — `PasswordStrength` renders 4 segments plus a live rule checklist on the register form.
1.3  MISSING — Email auto-confirm is enabled and `ProtectedRoute` only checks for a session, so no verification gate exists before dashboard access.
1.4  PASS   — `signIn` calls `signInWithPassword` through `AuthProvider`.
1.5  PASS   — `/auth/forgot` calls `resetPasswordForEmail` with a redirect to `/auth/reset`.
1.6  PASS   — `/auth/reset` completes the recovery-token flow and sets a new password.
1.7  MISSING — No `signInWithOAuth` call anywhere; Google sign-in is not implemented.
1.8  PASS   — `SessionTimeout` signs out at 30 minutes idle and routes to `/auth`.
1.9  PASS   — Warning dialog fires at 25 minutes with a "Stay Logged In" action.
1.10 MISSING — There is no `/admin/login` route; admins use the shared `/auth` screen.
1.11 PASS   — `RoleGuard` gates the UI and `removeUserAccount` re-verifies the admin role server-side against `user_roles`.
1.12 PASS   — All auth failures pass through `humanAuthError`, which never surfaces raw backend text.
1.13 PASS   — `ProtectedRoute` redirects unauthenticated users to `/auth` with a redirect param.

## SECTION 2: SECRET CODE + FILE SHARING SYSTEM

2.1  PARTIAL — `handle_new_user` does not create a code; it is generated lazily on first Settings visit and the format is an 8-char string (e.g. `K7QM2XPT`), not `PREFIX-XXXX`.
2.2  PASS   — Settings "Secret Code" tab shows the code with a copy button and a `QRCodeSVG` of the share URL.
2.3  PASS   — `UserMenu` renders the code chip with a copy-to-clipboard button.
2.4  PASS   — Regeneration requires typing `REGENERATE` and rewrites the code on profile and files.
2.5  PASS   — Upload dialog supports drag-and-drop with an active drop state.
2.6  PASS   — `BLOCKED_EXTENSIONS` blocks exactly .exe .sh .bat .msi .cmd .vbs .ps1 .jar.
2.7  PARTIAL — Sharing toggle has password + confirm + strength meter and `maxLength=20`, but no enforced 4-character minimum.
2.8  PASS   — One-time download toggle writes `one_time` on the file row.
2.9  PASS   — Expiry options Never / 24h / 7d / 30d map to `expires_at`.
2.10 PASS   — `hashPassword` digests SHA-256 over `value + "intellitrap-salt-2024"`, matching server verification.
2.11 PASS   — Post-upload modal is gated by a "password saved" checkbox before it can be closed.
2.12 PASS   — `computeFileStatus` yields Active/Expired/Consumed/Revoked (plus Private) with badge classes.
2.13 PASS   — Per-file "Revoke" action sets `share_revoked` with a confirm dialog.
2.14 PASS   — Download Log tab reads `file_access_log` for the owner's files.
2.15 PASS   — Storage bar uses blue < 50%, amber < 80%, red above.
2.16 PASS   — Amber warning card renders above 90% usage.
2.17 PASS   — `USER_STORAGE_QUOTA` = 1 GB and `USER_MAX_FILES` = 100; DB defaults match (1073741824, 100).

## SECTION 3: /share PAGE — INTELLIGENT ACCESS

3.1  PASS   — `/share` is a top-level public route outside `_authenticated`.
3.2  PASS   — Header shield uses the `slow-spin` animation.
3.3  PASS   — `ProgressSteps` renders Find File → Verify Access → Download.
3.4  PASS   — Code input is uppercase mono with letter spacing, shakes on failure, and shows "Files shared by {name}".
3.5  PASS   — Show/hide toggle, "N attempts remaining" counter, and CAPTCHA gate after 3 failures.
3.6  PASS   — Orbital rings, 1.5s 0→100% progress bar, staggered checklist.
3.7  PASS   — `runRandomForest` executes during the analyzing state on real behavioural features.
3.8  PASS   — `AnimatedCheckmark` draws itself, green "Access Granted", download uses the signed URL.
3.9  PASS   — Challenge is CAPTCHA (step 1) then email OTP (step 2); 3 OTP failures silently route to honeypot.
3.10 PASS   — Honeypot markup mirrors granted, decoys download as real Blobs, related-decoys list is shown.
3.11 PASS   — Blocked state is a full-screen `#0a0000` overlay with a drawn shield-X, no actions and no reason given.
3.12 PASS   — Download-complete shows the animated checkmark, one-time deletion notice, and "Access another file" reset.
3.13 PASS   — `SecurityAnalysisPanel` is rendered identically in both granted and honeypot branches.
3.14 PASS   — `behaviorTracker` captures mouse moves/distance, keystroke intervals, clicks and scrolls.
3.15 PASS   — Session token is created on mount by `TrackingProvider` and passed to every server call.

## SECTION 4: REAL-TIME VISITOR TRACKING

4.1  PASS   — `TrackingProvider` wraps the app in `__root.tsx` and re-fires on every pathname change.
4.2  PASS   — `clientIp()` reads x-forwarded-for / cf-connecting-ip inside the server function.
4.3  PASS   — `lookupGeo` enriches city, region, country, ISP, org, ASN, lat/lon, proxy/hosting flags.
4.4  PASS   — `getDeviceFingerprint` captures browser, OS, versions, screen, cores, memory, touch.
4.5  PASS   — Snapshot includes mouse moves, distance, keystrokes, avg interval, clicks, scrolls, copies, tab switches.
4.6  PASS   — Heartbeat posts behavioural data every 15s while not blocked.
4.7  PARTIAL — Online status is inferred from `is_online` plus heartbeat freshness; nothing sets `is_online=false` on tab close (no beforeunload/pagehide handler).
4.8  PASS   — `/visitors` subscribes via `useRealtimeTables(["visitors"])`.
4.9  PARTIAL — Records are written immediately, but the dashboard map query polls every 30s, so appearance can take longer than 5s.
4.10 PASS   — `trackVisitor` returns `blocked` and the provider navigates to `/blocked`.

## SECTION 5: GOOGLE MAPS LIVE MAP

5.1  PASS   — Dark theme comes from an inline `styles` array; `colorScheme` is not used.
5.2  PASS   — Hyderabad marker at [17.385, 78.4867] with a translucent blue radius circle plus ringed shield icon.
5.3  PASS   — `RISK_COLOR` = low #22c55e, medium #f59e0b, high #f97316, critical #ef4444.
5.4  PARTIAL — Online dots are larger (20px vs 14px) and full opacity, but the icons are static SVGs with no pulse ring.
5.5  PASS   — Offline dots render at 14px and 0.5 opacity.
5.6  PASS   — InfoWindow shows IP, city, ISP, device and risk/decision badges.
5.7  PASS   — "Click to view full profile" opens the visitor drawer.
5.8  PASS   — Filter pills All / Online Now / High Risk / India Only.
5.9  PASS   — Legend pinned bottom-left with the four risk colours.
5.10 PASS   — `EmptyOverlay` renders over a live map that still shows the Hyderabad marker.
5.11 PASS   — `LoadFailure` renders on API load error and when the key is missing.
5.12 PARTIAL — Map data refreshes on a 30s poll; the dashboard has no realtime channel, so new dots are not push-driven.

## SECTION 6: AI RISK ENGINE

6.1  PASS   — `src/lib/riskEngine.ts` defines tree1–tree15 in a 15-entry `TREES` array.
6.2  PASS   — Trees split across auth failures, network, biometrics, UA, velocity, repeat offences, temporal and combined signals.
6.3  PASS   — Votes are tallied and the highest-count decision wins.
6.4  PASS   — Score is the vote-weighted average of decision scores, clamped to 0–100.
6.5  PASS   — Confidence = winning votes / 15 as a percentage.
6.6  PASS   — Levels are low ≤30, medium ≤60, high ≤80, else critical.
6.7  PASS   — Decisions are granted / captcha_mfa / honeypot / blocked.
6.8  PASS   — `buildFeatures` derives suspicious UA from a 17-agent list, off-hours IST, and requests/min from timestamps.
6.9  PASS   — Breakdown maps named factors to point values.
6.10 PASS   — Top 3 signals are computed and persisted via `applyRiskVerdict`.
6.11 PASS   — "N% model confidence" shown in the analysis panel.
6.12 PASS   — All four vote counts (granted/caution/suspect/threat) are displayed in a 2×2 grid.

## SECTION 7: HONEYPOT SYSTEM

7.1  PASS   — `src/lib/decoyGenerator.ts` generates decoys entirely client-side.
7.2  PASS   — Exactly the 8 required categories are defined.
7.3  PASS   — Each category has multiple file names and realistic content templates plus MIME types.
7.4  PASS   — `generateDecoySet(3)` de-duplicates categories with a `used` set.
7.5  PASS   — Decoys download as real Blobs via an object URL.
7.6  PASS   — Honeypot entries and actions are inserted into `honeypot_activity`.
7.7  PASS   — Each decoy download logs the file name via `logHoneypotAction` plus a `visitor_events` row.
7.8  PASS   — `/honeypot` lists active trap sessions with realtime refresh.
7.9  PASS   — `TrapTimer` counts up per active session.
7.10 PASS   — Escalate-to-block and release actions are wired per session.

## SECTION 8: AUTO-BLOCK SYSTEM

8.1  PASS   — A `blocked` verdict upserts into `blocked_ips` on `ip_address`.
8.2  PASS   — Enforcement runs inside a server function using the service-role client.
8.3  PASS   — Trigger score, signals, geo snapshot and device snapshot are all stored.
8.4  PASS   — `/blocked` renders the dark denial page.
8.5  PASS   — `trackVisitor` checks `blocked_ips` on every navigation.
8.6  PASS   — `/blocked-ips` lists all blocks for admins.
8.7  PASS   — `liftBlock` sets `is_active=false`.
8.8  PASS   — Visitor drawer has a manual "Block IP" action writing `block_type: "manual"`.
8.9  PASS   — `block_type` is recorded as auto or manual at both call sites.
8.10 PARTIAL — `alertAdmins` inserts admin `notifications` rows and stamps `admin_alerted`, but no in-app notification UI reads them.

## SECTION 9: ADMIN SYSTEM

9.1  PASS   — `_authenticated/admin.tsx` wraps the subtree in `RoleGuard` and redirects non-admins to `/app`.
9.2  PASS   — Admin privilege is re-checked server-side against `user_roles` before any privileged action, backed by RLS.
9.3  PASS   — Pulsing red "ADMIN MODE" pill in the topbar.
9.4  PASS   — Gold crown icon next to the admin name in the user menu.
9.5  PASS   — Sidebar gets a dark red `border-t-[3px]` for admins.
9.6  PASS   — Admin dashboard renders exactly 6 global KPI cards.
9.7  PASS   — `AdminEventStream` shows all visitor events with realtime invalidation.
9.8  PASS   — `UsersTable` lists all registered users.
9.9  PASS   — Removal requires typing `CONFIRM REMOVE` and calls the service-role server function.
9.10 PASS   — Admin targets are rejected both client-side and inside the server function.
9.11 PASS   — Optional ban-IP and file deletion (storage objects plus rows) are performed on removal.
9.12 PASS   — The dialog surfaces the thrown error message rather than a generic string.
9.13 PASS   — `/admin/threat-intel` includes live access monitor, honeypot panel and auto-blocks table.
9.14 PASS   — Honeypot cards use an orange border with a pulsing card animation.
9.15 PASS   — Per-session action log renders recent honeypot actions.
9.16 PASS   — `/admin/audit-log` is read-only; no edit or delete controls exist.
9.17 PASS   — Rows show admin email, action type, target and IST timestamps.
9.18 PASS   — `/admin/settings` has Platform, Risk Thresholds and IP Rules tabs.
9.19 PASS   — `MlAnalysisPanel` shows the latest Random Forest verdict and factor weights.
9.20 PASS   — `RiskSignalChart` renders today's signal frequency.

## SECTION 10: ANALYTICS + MONITORING PAGES

10.1  PASS — 4 KPI cards: sessions tracked, online now, high risk, in honeypot.
10.2  PASS — Risk signal frequency bar chart via `RiskSignalChart`.
10.3  PASS — Risk distribution pie chart with labels and legend.
10.4  PASS — Top source cities bar chart.
10.5  PASS — Access decisions bar chart with per-decision colours.
10.6  PASS — Each chart has a friendly "No data yet" fallback.
10.7  PASS — `/visitors` lists all sessions with a realtime subscription.
10.8  PASS — `/threats` filters to high/critical risk.
10.9  PASS — `/honeypot` shows active traps.
10.10 PASS — `/blocked-ips` exposes the lift-block action.

## SECTION 11: PRESENTATION + POLISH

11.1  PASS   — Ctrl+Shift+P toggles presentation mode, enlarging the map to 600px and showing the banner.
11.2  PASS   — Zustand `persist` stores the flag under `it_presentation_mode`.
11.3  PASS   — `FirstRunBanner` appears at zero visitors with a URL copy button.
11.4  PASS   — Framer Motion `AnimatePresence` drives every `/share` state transition.
11.5  PASS   — `AnimatedCheckmark` is used on both granted and honeypot.
11.6  PASS   — Skeletons cover dashboard, admin, analytics and file tables.
11.7  PASS   — `EmptyState` / inline empty copy appears on tables, charts and the map.
11.8  PARTIAL — The sidebar collapses to a sheet at 768px (`MOBILE_BREAKPOINT`), not 1024px.
11.9  PASS   — Dark tokens throughout; no light-background surfaces found.
11.10 PASS   — `toIST` / `toISTTime` used for displayed timestamps.
11.11 PARTIAL — Error boundaries exist at the root (`errorComponent`) and around the authenticated outlet, but not per individual route.
11.12 PASS   — `useRealtimeTables` always removes its channel on unmount.
11.13 PASS   — `tsgo --noEmit` exits clean with no output.
11.14 PASS   — No `console.log` / `console.debug` in `src`.

## SUMMARY

Total items checked: 143

- PASS: 130
- PARTIAL: 10
- MISSING: 3

### ITEMS NEEDING ATTENTION

- 1.1 PARTIAL — special character is optional (3-of-4 rule satisfies validation).
- 1.3 MISSING — email auto-confirm is on and no verified-email gate protects the dashboard.
- 1.7 MISSING — Google OAuth sign-in is not implemented anywhere.
- 1.10 MISSING — no dedicated dark-red `/admin/login` page without Google OAuth.
- 2.1 PARTIAL — secret code is not created at registration and uses an 8-char format, not `PREFIX-XXXX`.
- 2.7 PARTIAL — share password has no enforced 4-character minimum (only a 20-char maximum).
- 4.7 PARTIAL — nothing marks `is_online=false` on tab close; offline is inferred from heartbeat staleness.
- 4.9 PARTIAL — dashboard map polls every 30s, so a new visitor may take longer than 5s to appear.
- 5.4 PARTIAL — online markers are larger but have no pulse ring animation.
- 5.12 PARTIAL — dashboard map has no realtime channel; it relies on polling.
- 8.10 PARTIAL — admin auto-block notifications are stored but no in-app UI displays them.
- 11.8 PARTIAL — sidebar collapse breakpoint is 768px instead of 1024px.
- 11.11 PARTIAL — error boundaries are root/layout level rather than per route.

PRESENTATION READINESS SCORE: 91/100
