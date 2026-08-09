# IntelliTrap — close the remaining gaps

Most of this brief is already live in the project. Below is what actually exists, what I'll add, and the two places where I'll keep the project's existing (more secure) approach instead of the literal spec.

## Already built — no work needed

- **Public `/share`** — already unauthenticated, standalone, `#020817` background, header with slow-spinning shield, 3-step progress, framer-motion step cards, and the full state machine (code → password → analyzing → granted / honeypot / blocked). Honeypot is styled identically to granted and serves real downloadable decoy blobs from `decoy_file_templates`, plus a "related files" section. Failed-attempt counter with lockout into honeypot is in place.
- **Sidebar** — grouped Monitoring / Workspace / Admin, admin group only for admins, red top accent for admins, blue active accent, live count badges, collapses to icon strip on mobile.
- **Monitoring pages** — `/visitors`, `/threats`, `/honeypot`, `/blocked-ips`, `/analytics`, `/admin/*` all exist with realtime subscriptions (cleaned up on unmount), risk badges, and friendly empty states.
- **Admin console** — platform stat cards, users table with role toggle and typed "CONFIRM REMOVE" removal, audit log, threat intel, settings.
- **Display-name auto-fix** — profile load backfills a null `display_name` from full name or email prefix.
- **Storage quota** — 1 GB / 100 files constants, computed from real file sizes.

## What I'll add this round

1. **Storage tab polish** (`/files` → Storage)
   - Progress bar colour thresholds: blue under 50%, amber under 80%, red at 80%+.
   - Show usage as `X.X MB / 1 GB`.
   - Amber warning card when usage passes 90%: "Storage almost full. Delete old files to free space."

2. **Topbar / user menu enhancements**
   - Secret-code chip in the account dropdown (dark mono chip, blue text) with a copy button and a "Code copied!" toast.
   - Pulsing red `ADMIN MODE` pill in the topbar for admins, plus a gold crown beside the name in the dropdown.

3. **`src/lib/formatters.ts`**
   - Add the four shared helpers (`formatFileSize`, `timeAgo`, `toIST`, `formatSeconds`) as re-exports/wrappers over the existing `src/lib/share/format.ts` implementations, so both import paths work and nothing existing breaks.

4. **Global CSS**
   - Add a plain `spin` keyframe and the thin 4px webkit scrollbar rules. (`visitorPulse`, `criticalGlow`, and the JetBrains Mono mono-font token already exist.)

## Two deliberate deviations

- **Roles come from `user_roles`, not `profiles.role`.** Admin checks stay on the existing `useAuth().isAdmin` (backed by the `user_roles` table and `has_role`). Reading a role column off `profiles` would be a privilege-escalation risk, so I won't switch to it.
- **Blocked routes keep their current split.** `/blocked` stays the attacker-facing "Access Denied" page (the tracker redirects there), and the admin IP list stays at `/blocked-ips`. Swapping them would break the live block redirect.

## Technical notes

- Password verification already runs through the `verifyFilePassword` server function, which uses the service-role client server-side and returns `{ success, blocked, error }`. That is strictly safer than a browser-side query against `files`, so I'll keep it as the primary path and leave the existing client fallback untouched rather than adding a raw anonymous `files` select.
- No new packages. No changes to auth pages, upload flow, or the existing file list.
- Ends with a clean `tsgo` typecheck (zero TypeScript errors).
