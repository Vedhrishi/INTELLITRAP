# Fix confusing sign-in / sign-up failures

## What's actually happening

The backend auth log for your last attempt shows the real cause:

```text
POST /signup → 422
"Password is known to be weak and easy to guess, please choose a different one."
```

Sign-up is being rejected because breach-checking (HIBP) is switched on for this
project, and the password you picked appears in known password dumps.

The bug is that you can't tell. `src/lib/auth/auth-errors.ts` only recognises the
words "pwned" and "compromised" (lines 11-12) — the real message says "weak", so
it falls through to the catch-all on line 18 and the screen just says
**"Something went wrong. Please try again."** That's the difficulty: a specific,
fixable problem is being reported as a mystery failure.

Two related weaknesses feed into it:

- The register form's own password check (`src/lib/auth/auth-schemas.ts`, 8+ chars
  and 3 of 4 character classes) happily accepts `Password123!`, which the backend
  then rejects. The form promises "strong" and the server disagrees.
- Failures only appear as a toast that fades; nothing is marked on the password
  field, so the form looks unchanged after a rejected submit.

Sign-in itself is healthy — the same log shows a successful password login at
07:09 UTC, and all 12 accounts are confirmed, so no one is stuck on an
unconfirmed email.

## What I'll change

1. **Say what went wrong.** Extend the error mapping to cover the messages the
   backend actually returns: weak/easy-to-guess passwords, "signups not allowed",
   invalid email address, "for security purposes ... after N seconds" (send-rate
   limiting), and expired or already-used links. Each gets a plain sentence
   telling the user what to do next.

2. **Show the error on the field, not just in a toast.** The register and login
   forms will set the error on the relevant input (password for weak/incorrect,
   email for already-registered or invalid) so it stays visible under the box
   while the toast handles the announcement.

3. **Catch weak passwords before submitting.** Add a small check for the common
   patterns the breach list always rejects — `password`, `qwerty`, `12345678`,
   `letmein`, `admin`, the email's own prefix, and long digit-only or
   single-repeated-character strings. The strength meter gets an explicit
   "too common — appears in breach lists" state, so the rejection happens
   instantly and locally instead of as a server round trip.

4. **Handle the post-registration state honestly.** After a successful sign-up,
   check whether a session actually came back. If yes, continue into the app as
   today. If not (email confirmation required), show "Check your email to confirm
   your account" and stay on the auth page instead of navigating to `/app` and
   bouncing straight back to sign-in.

5. **Make the submit state unambiguous.** Buttons read "Signing in…" /
   "Creating account…" while in flight and inputs are disabled, so a slow
   response can't be mistaken for a dead button or double-submitted.

## Technical notes

- Files touched: `src/lib/auth/auth-errors.ts` (message coverage),
  `src/lib/auth/auth-schemas.ts` (common-password rule),
  `src/components/auth/register-form.tsx`, `src/components/auth/login-form.tsx`,
  `src/components/auth/password-strength.tsx`, and `signUp` in
  `src/lib/auth/auth-context.tsx` (return whether a session was created).
- Breach checking stays **on**. It's the secure default and it's what your
  capstone's threat story wants; the fix is honest feedback, not weaker rules.
- No changes to the auth database schema, RLS, roles, the protected-route gate,
  tracking, `/share`, or the admin users table.
- Verification: attempt a sign-up with a known-breached password and confirm the
  form says the password is too common instead of "Something went wrong"; then
  register with a strong password and confirm it lands in the app; then confirm
  a wrong-password sign-in shows "Email or password is incorrect."
