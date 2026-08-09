# Two targeted bug fixes

## Bug 1 — Shared-file password always rejected

Upload hashes the password with no salt (`hashPassword` in `src/lib/share/format.ts`), while verification hashes it with the `intellitrap-salt-2024` salt (`hashSharePassword` in `src/lib/tracking/tracking.server.ts`). The hashes never match.

Fix: add the same salt inside `hashPassword`. One function, one line changed; nothing else in the upload flow or the verify server function changes.

Note: files uploaded before this fix keep their old unsalted hash and will still fail — they need to be deleted and re-uploaded.

## Bug 2 — "Failed to remove user"

Confirmed root cause: removal is done client-side and its first step sets `profiles.status = 'removed'`, but the database only allows `active`, `flagged`, `quarantined`, `banned`. The insert is rejected by that constraint, so the whole action throws before anything else runs. A second, quieter problem: an admin has no permission to touch another user's file rows, so the "delete all files" checkbox silently does nothing, and the account is never actually deleted from auth, so the row stays in the table.

Fix: move removal to a privileged server function that runs with service-role access.

New server function `removeUserAccount` in `src/lib/admin/admin.functions.ts`:
- uses the project's existing `requireSupabaseAuth` middleware, then verifies the caller actually has the `admin` role (never trusting the client)
- refuses to remove any target that holds the `admin` role
- when "delete all files" is checked: removes the objects from the `user-files` bucket, then deletes the file rows
- when "ban IP" is checked: upserts the target's last-login IP into `blocked_ips` with `block_type: 'manual'`
- writes the removal into `admin_audit_log`
- deletes the auth user with the service-role admin client (this cascades the profile row away, so the user disappears from the table)
- if the auth deletion fails, falls back to marking the profile `banned` (a value the database accepts) and reports that outcome

`removeUser` in `src/lib/admin/admin-data.ts` becomes a thin call into that server function, so `remove-user-dialog.tsx` keeps its current call shape.

Dialog error handling: surface the real error text from the failure instead of the generic "Failed to remove user" string, so any future failure is visible.

## Technical notes

- New file `src/lib/admin/admin.functions.ts` (client-safe path); `@/integrations/supabase/client.server` is imported with `await import(...)` inside the handler only, per the project's import-boundary rules.
- No migration needed — the fix avoids the invalid status value rather than widening the constraint.
- Untouched: auth pages, upload UI, sidebar, landing page, tracking, dashboard.

## Verification

- Re-upload a file with a password, then run the `/share` flow: the correct password advances to the analyzing screen.
- Remove a non-admin test user from the admin dashboard: success toast, row gone from the table.
- Typecheck and lint clean.
