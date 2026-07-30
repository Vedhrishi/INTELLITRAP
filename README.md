# IntelliTrap

Secure cloud storage with an AI deception layer.

## Status

**Phase 1 complete** — design system, shared primitives, app shell, landing page.
Later phases (auth, schema/RLS, file product, threat detection, honeypot, admin
console, AI reports) build on top of these foundations.

## Stack notes / deviations from the brief

- **Router:** the project runs on TanStack Start + TanStack Router (file-based
  routing under `src/routes/`). React Router DOM is not supported on this
  platform; routing intent is implemented 1:1 with TanStack Router.
- **Backend:** Lovable Cloud (managed Supabase) provides auth, Postgres + RLS,
  Storage and server functions. Privileged logic will run in server functions
  with the service-role key — never in client code.
- **Tailwind v4:** there is no `tailwind.config.ts`. All design tokens are
  declared CSS-first in `src/styles.css` (`@theme inline` + `:root`/`.dark`),
  which is the v4 equivalent of the config mapping described in the brief.
- **Fonts:** Inter (UI) and JetBrains Mono (IDs, hashes, IPs, logs) are loaded
  via `<link>` in the root route head, as required by the Tailwind v4 build.

## Design system

Tokens live in `src/styles.css` as HSL values behind semantic names. Components
must only use semantic utilities (`bg-background`, `text-muted-foreground`,
`border-border`, `bg-primary`, `text-success`, …). Raw colours are forbidden.

- Palette: dark-first SOC aesthetic, with a complete light theme for every token.
- Radius: `--radius: 0.75rem`.
- Elevation: `shadow-sm`, `shadow-md`, `shadow-glow` (glow uses primary at low alpha).
- Gradients: `bg-gradient-hero`, `bg-gradient-card`.
- Motion: 150ms hover / 250ms enter, nothing above 400ms, `prefers-reduced-motion`
  fully honoured in `src/styles.css`.
- Severity map: critical → destructive, high → warning, medium → accent,
  low → muted, consumed only through `<SeverityBadge>`.
- Theme toggle persists to `localStorage` under `intellitrap-theme`; dark is the
  server-rendered default so there is no flash of light theme.

## Shared primitives (`src/components`)

| Primitive | Path |
| --- | --- |
| AppShell / Sidebar / TopBar | `layout/app-shell.tsx`, `layout/app-sidebar.tsx`, `layout/top-bar.tsx` |
| PageHeader | `primitives/page-header.tsx` |
| StatCard | `primitives/stat-card.tsx` |
| DataTable (sort + search + paginate + skeleton + empty + error) | `primitives/data-table.tsx` |
| EmptyState / ErrorState | `primitives/empty-state.tsx`, `primitives/error-state.tsx` |
| ConfirmDialog | `primitives/confirm-dialog.tsx` |
| SeverityBadge / StatusDot | `primitives/severity-badge.tsx`, `primitives/status-dot.tsx` |
| CopyableCode / FileIcon | `primitives/copyable-code.tsx`, `primitives/file-icon.tsx` |
| Timeline / ChartCard | `primitives/timeline.tsx`, `primitives/chart-card.tsx` |

Every data surface is expected to render four explicit states: loading
(skeletons), empty (illustrationless icon + CTA), error (message + retry), and
success. Severity is always communicated by glyph + text as well as colour.

## Honest scope limits

Network firewalling, packet inspection, real IP-layer blocking and malware
sandboxing are out of scope and are **not** simulated as real. IntelliTrap
implements the application-layer equivalents only: request scoring, session
diversion, application-level IP blocklisting, and MIME/magic-byte upload checks.

## Phase 2 — Authentication & Roles

**Database.** `app_role` enum (`admin` | `analyst` | `user`), `public.profiles`
(1:1 with the auth user), and `public.user_roles` (roles are **never** stored on
the profile, to prevent privilege escalation). `public.has_role(uuid, app_role)`
is a `SECURITY DEFINER` function used by every RLS policy to avoid recursive
policy evaluation. `public.handle_new_user()` creates the profile and assigns the
default `user` role on signup. RLS is enabled everywhere; users see only their own
rows, admins see all.

**Conventions chosen where the brief was silent**
- Email confirmation is auto-confirm (signup signs the user straight in) and
  leaked-password protection (HIBP) is enabled.
- `has_role` keeps `EXECUTE` for `authenticated` because RLS policies depend on it;
  `handle_new_user` / `set_updated_at` are revoked from all client roles.
- Forgot-password always returns the same neutral confirmation so account
  existence can't be enumerated.
- Raw backend auth errors are mapped to friendly copy in `src/lib/auth/auth-errors.ts`.
- Protected routes live under `src/routes/_authenticated/` (`ssr: false`, since the
  session lives in browser storage). `ProtectedRoute` renders an app-shaped skeleton
  while the session resolves, so there is no flash of the login screen, and preserves
  the intended path in a validated same-origin `?redirect=` param.
- `RoleGuard` is UX only — the real boundary is RLS plus `has_role()`.

**Files**: `src/lib/auth/*`, `src/components/auth/*`, `src/components/layout/user-menu.tsx`,
`src/components/layout/app-layout.tsx`, `src/routes/auth.*`, `src/routes/_authenticated/*`.
