# Security notes

No system is "perfectly safe". This file lists what is protected, what was changed in the hardening pass, and what remains.

## In place

- Row-level security on all tables; storage under per-user prefixes; admin-only block management.
- Share passwords and OTP codes are stored only as hashes; OTP codes expire after 10 minutes.
- Behavioural risk scoring, honeypot diversion, and automatic IP blocking (see `ml/REVISION_RESPONSE.md`).
- Payload and upload screening (`src/lib/threatClassifier.ts`).

## Hardening pass (this commit)

- OTP guessing locked out: 5 wrong codes void the code.
- OTP email sending rate-limited: 3 per session per 10 minutes, 10 per IP per hour (stops using the site as a spam relay).
- Constant-time comparison for password and OTP hashes.
- Security headers on every response (nosniff, referrer policy, permissions policy, HSTS, frame-ancestors).
- `npm audit fix` applied: 0 known vulnerabilities in dependencies at the time of the change.
- Optional `supabase/hardening_staff_only_telemetry.sql` limits visitor telemetry to staff.

## Second hardening pass

- Share passwords now use PBKDF2-HMAC-SHA256 with a random per-password salt (`src/lib/share/password-hash.ts`); legacy hashes are still accepted.
- CI runs typecheck, lint, tests, build and `npm audit` on every push and PR.

## Known remaining risks

- Shares created before the PBKDF2 change keep their old fixed-salt SHA-256 hash. They still verify but are not upgraded in place; re-share the file to get a PBKDF2 hash.
- Visitor telemetry is readable by any signed-in user until the optional SQL above is run.
- No full Content-Security-Policy yet (Google Maps and Supabase origins need to be allow-listed and tested).
- IP blocking is per address, so shared networks can be blocked together.
- The project's `.env` is tracked in git (managed by Lovable); never put secret keys in it. Keep secrets only in Vercel environment variables.
- Rotate the Supabase service-role key and database password if they were ever shared in chat, screenshots, or files.
