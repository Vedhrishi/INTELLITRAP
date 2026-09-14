# End-to-end check: sign-up through file sharing

Verdict: the main path works. One person signs up, uploads, shares a code plus a password, and the other person downloads. Two real gaps break the "many files" and "no secret code" cases.

## What works today

- **Registration** — creating an account also creates the person's profile, gives them a role, and generates their personal 8-character secret code automatically.
- **Storage per person** — every upload lands in a folder keyed to that account, with a 1 GB / 100-file cap enforced by the database itself, so one person can never see or fill another's space.
- **Sharing with a code + password** — the uploader picks a password at upload time; it is stored only as a fingerprint, never in readable form. The recipient goes to `/share`, enters the code, then the password, and gets a short-lived download link. Expired links, already-used one-time links, and revoked files are each refused with their own message.
- **One-time links** — the file is only burned after the download actually succeeds, which is why the earlier "NoSuchKey" failure is gone.
- **Wrong guesses** — repeated wrong passwords move the visitor into the decoy trap and raise their risk score.

## Gap 1 — only the newest shared file is reachable

The code is one code per person, not one per file. When someone shares several files, the lookup returns only the most recently uploaded one, so every earlier shared file is unreachable even with the correct code and password.

Live data confirms this: one account currently has 5 active shared files behind a single code, so 4 of them cannot be opened by anyone.

Fix: after the code is accepted, show the recipient the list of files shared under that code (name, size, date) and let them pick one, then ask for that file's password. Falls back to today's behaviour when only one file is shared.

## Gap 2 — sharing without a secret code does not exist

There is currently no way to send someone a plain link. Sharing is only ever code + password. Three files also carry no code at all (uploaded before codes existed), which makes them permanently unreachable through `/share`.

Fix: add a "link only" share option:

- The uploader chooses "Anyone with the link" instead of "Code + password".
- A long random one-off link is generated, shown once, and copyable, with the same expiry / one-time / revoke controls as today.
- Opening that link goes straight to the risk check and download step, skipping both the code and the password screens.
- Risk scoring, the decoy trap, blocking, and access logging apply exactly as they do now.
- Backfill the three code-less files onto the owner's current code so they become reachable again.

## Smaller items

- The share instructions tell the recipient the password "was shown once when you uploaded" — accurate, but the only recovery is revoke-and-re-upload. Worth an explicit "set a new password" action on an existing shared file.
- The `/share` email step issues a demo one-time passcode shown on screen; it is not a real email. Flag it as demo or wire it to real email.

## Technical notes

- Lookup limitation: `verifyFilePassword` / `findShareOwner` in `src/lib/tracking/tracking.functions.ts` filter `files` by `uploader_secret_code` with `.order("created_at", desc).limit(1).maybeSingle()` — hence one file per code.
- New server functions needed: `listSharedFilesForCode` (safe columns only), plus `resolveShareToken` for link-only shares, both reusing the existing IP-block, expiry, one-time and logging checks.
- Link-only shares reuse the existing `file_shares` table (currently unused, 0 rows) for the token, or add a `share_token` column on `files`; token generated server-side, compared as a hash.
- `/share` state machine in `src/routes/share.tsx` gains a `pick_file` state between `enter_code` and `enter_password`, and a token entry path that starts at `analyzing`.
- Upload flow (`src/components/files/upload-dialog.tsx` step 2) gains the share-mode choice; `share-info-dialog.tsx` shows either the code+password guidance or the copyable link.
