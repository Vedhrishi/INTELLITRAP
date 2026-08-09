# IntelliTrap — Live Visitor Intelligence, Honeypot Sharing & Admin Console

Builds the visitor-tracking, secret-code sharing, honeypot and admin-console layers from the brief on top of the existing app (landing, auth, roles, files schema). Delivered in five phases; each phase ends working and verifiable.

## Two deliberate deviations (both required by this platform)

1. **Backend logic runs as server functions / API routes**, not Supabase Edge Functions — this project's runtime doesn't use edge functions. Same behaviour: visitor tracking, risk assessment, file-password verification, admin alerting, user removal.
2. **Role authority stays in the existing roles table.** The brief's `profiles.role` column is added as a display mirror only; `is_admin()` reads the secure roles table so nobody can grant themselves admin by editing their profile. Everything else in the brief's schema is created as written.

Because all visitor writes go through the server (trusted service credentials), the tables do **not** get public write access — visitors can't tamper with their own risk scores. Reads stay admin-only.

## Phase A — Data layer + tracking engine

- Migration adding: `visitors`, `visitor_events`, `ip_intelligence`, `blocked_ips`, `decoy_file_templates`, `honeypot_activity`, `platform_settings`, `admin_audit_log`, plus indexes, admin-only read policies, grants, realtime publication, the 11 platform settings and 6 decoy templates.
- Extra columns on existing tables: `profiles.user_secret_code / display_name / registration_ip / registration_geo / last_login_ip / last_login_geo / login_count / setup_complete / role (mirror)`; `files.file_password_hash / one_time / expires_at / uploader_secret_code / share_revoked / consumed / is_shared / upload_ip`; `file_access_log` table.
- `src/lib/tracker.ts` — session/visitor IDs, device fingerprint (ua-parser-js), behaviour tracker (mouse, keys, clicks, scrolls, copies, tab switches), heartbeat, `trackPageView`, `logEvent`, `assessRisk`.
- `TrackingProvider` mounted in the root route so every page tracks; cleans up all listeners.
- Server functions: `track-visitor` (IP + geo lookup, upsert visitor/IP intel), `assess-visitor-risk` (full weighted scoring from the brief → granted / captcha_mfa / honeypot / blocked, auto-block + admin alert), `verify-file-password`, `admin-remove-user`. Admin email alerts via the project's email sending.
- Global CSS animations (orbit, visitorPulse, honeypotGlow, criticalGlow, scanline).

## Phase B — /dashboard

6 KPI cards with count-up animation and live pulse; keyless dark world map (MapLibre + OpenStreetMap tiles, no API key) with the Hyderabad "PROTECTED ZONE" pulsing rings, one marker per located visitor coloured by risk, click-to-InfoWindow, filter pills (All / Online / High Risk / India), realtime insert/update; live event feed (30 events, colour-coded, slide-in); online visitors table; right-side visitor detail drawer (risk breakdown, network, device, behaviour, journey, timeline, Block / Honeypot / Whitelist actions). Empty-first: map renders with the copyable URL card when no visitors.

## Phase C — /share (standalone, no shell)

State machine: `enter_code → enter_password → analyzing (1.5s orbital animation) → granted | challenge | honeypot | blocked → download_complete`. Honeypot state is pixel-identical to granted, serves real decoy downloads from templates and logs every action live. Blocked state shows only a reference ID. All attempts logged as visitor events.

## Phase D — Workspace routes

`/files` (3 tabs, 3-step upload modal with secret sharing, password hashing, one-time + expiry, QR share info, revoke/delete, download log, storage tab), `/visitors`, `/threats`, `/ip-intel`, `/honeypot`, `/blocked`, `/analytics`, `/settings`. Sidebar and topbar rebuilt to the brief: grouped nav with live badge counts, active-item motion indicator, realtime LIVE/OFFLINE pill, blocks bell, secret-code chip, admin styling.

## Phase E — Admin console + demo mode

`/admin/dashboard`, `/admin/threat-intel` (live access monitor, active honeypot panel, auto-blocks table, risk-signal chart), `/admin/audit-log` (immutable, CSV export), `/admin/settings` (toggles, thresholds, IP lists, LOCKDOWN). Users table with the type-CONFIRM-REMOVE modal calling the removal server function; admin rows protected. Presentation mode (Ctrl+Shift+P) with scaled type, taller map, faster animations, DEMO MODE badge.

## Technical notes

- New packages: framer-motion, ua-parser-js, qrcode.react, date-fns, date-fns-tz, maplibre-gl, recharts (if absent). No Google Maps key needed.
- Every query error-handled with friendly messages, loading skeletons, empty and error states, ErrorBoundary per page; every realtime channel unsubscribed on unmount.
- Zero mock data anywhere — empty states are the first-run experience.
- Existing landing, auth pages, auth context, router files and migrations are left untouched.
