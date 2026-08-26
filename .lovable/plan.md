# Auth hardening: tests, failure triage, reset flow, resend cooldowns

Four related pieces of work on the sign-in / sign-up / password-reset surface.

## 1. Automated tests for login and registration

There is currently no test tooling in the project (no test runner in
`package.json`). I'll add Vitest + Testing Library and write tests that render the
real forms with the backend calls stubbed:

- Login: empty submit shows "Email is required" / "Password is required"; a
  wrong-credentials response renders "Email or password is incorrect." **under the
  password field** (not only as a toast); the button switches to "Signing in…" and
  inputs lock while in flight.
- Registration: `Password123!` and `qwerty12` are rejected locally with the
  "Too common — this appears in breach lists" message and never reach the backend;
  a password reusing the email prefix is rejected; mismatched confirm password
  errors on the confirm field; an "already registered" backend error lands on the
  email field; a successful sign-up with no session shows the "Confirm your email"
  screen instead of navigating.
- Unit tests for `describeAuthError` (every branch maps to the right field) and
  `commonPasswordIssue`.

Plus one Playwright browser spec that drives the real app on the dev server:
register with a breached password (expect the inline rejection), register with a
strong one, then sign in with a wrong password. It is kept separate from the unit
suite so it never blocks a build.

## 2. Log auth failures and surface them for triage

New `auth_failure_log` table recording only non-sensitive fields: timestamp,
masked email (`v••••u@gmail.com`), reason code (`invalid_credentials`,
`weak_password`, `email_not_confirmed`, `rate_limited`, `signup_disabled`,
`other`), which flow it came from (login / register / reset), IP, country/city,
user agent. **Never** the password, the attempted password, or a token.

- Written by a new public server function called from the auth forms whenever a
  failure comes back. Rate-limited per IP so the endpoint can't be used to flood
  the table.
- Read-only for staff via RLS (`private.is_staff()`); no anon read.
- New "Authentication failures" panel on `/admin/threat-intel`: last 50 attempts,
  reason badges, a per-reason count for today, and a highlight when one IP or one
  masked email exceeds 5 failures in 15 minutes (credential-stuffing signal). Live
  via the existing realtime refresh hook.

## 3. Password reset form with pre-submit strength validation

`/auth/reset` already validates strength, so this is completion rather than a new
screen:

- Guard the page: if the recovery link is missing or expired, show "That reset
  link has expired or was already used" with a link back to `/auth/forgot`,
  instead of a form that fails on submit.
- Show the strength meter's blocking reason inline and keep the submit button
  disabled until the password passes (currently you can submit and get a server
  error back).
- Explicit success state ("Password updated — you're signed in") before
  redirecting, and mapped failure messages on the field (reused password, weak
  password, expired session) instead of a generic toast.

## 4. Resend cooldown with an accurate countdown

Shared cooldown hook used by both flows:

- "Confirm your email" screen (after registration) gets a **Resend confirmation
  email** button; `/auth/forgot`'s sent state gets **Resend reset link**.
- 60-second cooldown by default, showing "Resend in 0:47" and ticking down each
  second, disabled while counting.
- When the backend replies "you can only request this after N seconds", the
  countdown is set to that exact N rather than the local guess — so the timer
  matches reality.
- Deadline is stored per email in `sessionStorage`, so a refresh or navigating
  back doesn't reset the timer and let the user trip the server limit.

## Technical notes

- New: `src/lib/auth/use-resend-cooldown.ts`, `src/lib/auth/auth-failures.functions.ts`,
  `src/components/admin/auth-failure-panel.tsx`, tests under `src/**/__tests__/`,
  `vitest.config.ts`, `playwright/auth.spec.ts`.
- Edited: `login-form.tsx`, `register-form.tsx`, `auth.forgot.tsx`, `auth.reset.tsx`,
  `auth-errors.ts` (export a machine reason code alongside the human message),
  `admin.threat-intel.tsx`, `admin-data.ts`, `package.json` (test devDeps + script).
- One migration: create `auth_failure_log`, grants, RLS (staff SELECT, no anon),
  index on `(created_at desc)` and `(ip_address, created_at)`.
- Not touched: the roles model, protected-route gate, tracking pipeline, `/share`,
  files, admin users table. Breach checking stays enabled.
- Verification: run the unit suite, run the Playwright spec against the dev
  server, then confirm a wrong-password sign-in appears in the admin panel as
  `invalid_credentials` with a masked email, and that the resend button counts
  down correctly on both screens.
