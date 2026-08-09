# IntelliTrap — fill the remaining gaps

Much of this brief is already live in the project: visitor tracking with heartbeats and behaviour telemetry, the Google Maps live visitor map, the expanded dashboard (KPI cards, live event feed, online visitors table, visitor drawer, first-run banner), the public `/share` honeypot flow, and the admin console (`/admin/dashboard`, `/admin/threat-intel`, `/admin/audit-log`, `/admin/settings`). Those stay untouched. The work below is only what is genuinely missing or wired to old values.

## 1. Storage quota — 1 GB per user

Confirmed current state: `profiles` already has `storage_used` / `storage_quota` (kept — no duplicate `*_bytes` columns), a quota-enforcing trigger, and auto-recalc on file insert/delete. `platform_settings` has 11 rows with `max_file_size_bytes = 52428800`, and no quota/pool keys yet.

- Migration: add `max_files` (default 100) to `profiles`; set every user's `storage_quota` to 1 GB and the default to 1 GB; update `max_file_size_bytes` to 1 GB; insert `user_storage_quota_bytes`, `user_max_files`, `total_pool_bytes` (10 GB) settings.
- Storage tab on `/files`: replace the hardcoded 50 MB with the real quota — "Storage used: X MB / 1 GB", progress bar, and "Files: X / 100".
- Upload dialog: block upload when used + new file exceeds the quota or the file count hits the max, with the toast "Storage full. Delete files to free space."
- Deletion already reclaims space via the existing trigger; no change needed there.

## 2. `/blocked` page + redirect

- New public route `/blocked`: dark red page, ShieldX, "Access Denied", "Your IP address has been blocked.", "This incident has been logged." No nav, no buttons.
- Tracking provider: when the visitor is flagged blocked, redirect to `/blocked` instead of only setting internal state.

## 3. Expanded sidebar with live badges

Replace the current 3-item sidebar with three sections:

- Monitoring: Dashboard, Live Visitors (green online count), Threats (red high+critical), Honeypot (orange active traps), Blocked IPs (amber active blocks).
- Workspace: Secure Files, Analytics, Settings.
- Admin (admin only): Admin Console (gold crown), Threat Intel, Audit Log — admin sidebar gets the 3px `#7f1d1d` top border.

Badge counts come from live queries, hidden at zero. Active route styled `bg-blue-500/10` with a blue left border.

## 4. New monitoring routes

Four new authenticated pages reusing existing components and data helpers, so nothing is duplicated:

- `/visitors` — all visitors feed with filters and the existing detail drawer.
- `/threats` — high/critical visitors plus the risk-signal chart.
- `/honeypot` — the existing honeypot monitor panel as its own page.
- `/blocked-ips` — the auto-blocks table with lift/add manual block.
- `/analytics` — traffic, risk mix and top countries charts (recharts).

Sidebar "Blocked IPs" points at `/blocked-ips` so it can't collide with the public `/blocked` page.

## 5. Admin storage management

- New storage panel on `/admin/dashboard`: total pool 10 GB, used across all users, available, and a per-user usage bar chart sorted heaviest first.
- Per-user actions: raise/lower that user's quota, and force-delete a user's files (storage objects + rows) to reclaim space.
- Extend the existing remove-user dialog with the "Delete all their files (GDPR)" checkbox showing "Storage reclaimed: X MB", keeping the existing "CONFIRM REMOVE" typing gate and audit logging.

## Technical notes

- All new routes are TanStack Router file routes with their own `head()` metadata; `/blocked` is public, the rest live under `_authenticated`.
- Quota writes and file force-deletes go through server functions with an admin role check; ordinary reads stay on the browser client under RLS.
- No new packages: framer-motion, recharts, `@vis.gl/react-google-maps`, date-fns and ua-parser-js are already installed.
- Existing tracking, share, dashboard, auth and upload internals are only touched where the brief requires (quota checks, blocked redirect).
- Typecheck must end clean.
