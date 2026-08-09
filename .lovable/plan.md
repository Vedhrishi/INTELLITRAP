# All 4 fixes are already in place

I read each target file before planning. Every one of the four requested fixes already exists in the current code, so there is no change to make.

## Verification

1. **Password hash salt** — `src/lib/share/format.ts` line 61 hashes `` `${value}intellitrap-salt-2024` ``, matching the server-side verifier in `tracking.server.ts` line 176 (same salt). Behaviour is identical to the requested version.
2. **Map dark theme** — `LiveVisitorMap.tsx` has no `colorScheme` prop; the `Map` component already passes a `styles` array with the dark palette (`#0f172a` geometry, `#020817` water, etc.), which works on all Maps API tiers.
3. **Remove user server function** — `src/lib/admin/admin.functions.ts` exports `removeUserAccount`, an admin-verified server function that uses the service-role client to wipe files, ban IPs, write the audit log, and delete the auth user (falling back to `status: 'banned'` if deletion fails). `admin-data.ts` `removeUser()` delegates to it, and `remove-user-dialog.tsx` already surfaces the real error via `error instanceof Error ? error.message : "Failed to remove user"`.
4. **Analytics charts** — `analytics.tsx` imports recharts and renders Risk Distribution (pie + legend), Top Source Cities (bar), and Access Decisions (bar), each with a friendly empty state, in a responsive grid.

## Only cosmetic difference

The analytics page computes `riskDistribution`, `topCities`, and `decisions` as plain derived values rather than inside `useMemo`. Output is identical; the lists are small, so memoisation adds nothing. I can wrap them in `useMemo` if you want it to match the snippet exactly.

## Proposed action

No code changes. Approve if you'd like me to do the optional `useMemo` wrap; otherwise the batch is complete as delivered.

Reminder: files uploaded before the salt fix still carry old unsalted hashes and must be deleted and re-uploaded once.
