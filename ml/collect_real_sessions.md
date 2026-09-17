# Protocol: collecting a small REAL validation set

Everything trained in `ml/train.py` used **synthetic** data (see
`ml/generate_dataset.py`'s header). That's a fair and expected criticism from
reviewers. This protocol collects a small (~60-100 session) set of **real**
attacker-like and legitimate sessions, measured against the actual running
app, to validate the trained model outside the synthetic distribution it was
trained on. `ml/validate_real.py` (Step 10) consumes the two CSVs this
protocol produces.

This is explicitly a **small proof-of-concept validation set**, not a
replacement training corpus -- 60-100 sessions collected by the project team
is not independent, large-scale data. Say that plainly in the paper (see
`ml/PAPER_SECTIONS.md`).

## Before you start: safety / data-hygiene warning

This repo has **no separate local/mocked Supabase stack** -- `SUPABASE_URL`
in your `.env` points at a real, hosted Supabase project (project id in
`supabase/config.toml`), and both the automated and manual sessions below go
through the app's real server functions. That means:

- Real rows get written to `visitor_events` (and `honeypot_activity` /
  `blocked_ips` if a session is severe enough to trigger those paths).
- Your own IP can get **auto-blocked** by the app's real enforcement logic
  if enough sessions look sufficiently malicious back-to-back (a `blocked`
  verdict writes to `blocked_ips` and the app checks that table before
  granting future access from that IP).
- If this Supabase project is the same one backing your live public
  deployment, this will pollute the real admin dashboard / ML analysis
  panel with test data.

**Recommended:** point `.env` at a separate, disposable Supabase project
while collecting this data (create a free one, run the migrations in
`supabase/migrations/`, swap `SUPABASE_URL` / keys back afterward). If you
instead run this against your existing project, know that you're doing that
and plan to manually clean up the test rows (by `session_token` prefix or
timestamp range) afterward.

## Prerequisites

1. `npm install -D playwright && npx playwright install chromium`
2. `npm run dev` running locally (default `http://localhost:3000`).
3. At least one real file share created through the app's normal
   share-creation flow (admin/dashboard area), so you have a real
   **share code** and **password** to test against. The attacker script
   only *attacks* an existing share -- exactly what a real attacker would
   have (the public `/share` link and nothing else).

## Part A -- attacker-like sessions (automated, ~30-50 sessions)

Run:

```bash
INTELLITRAP_SHARE_CODE=YOUR-REAL-CODE N_SESSIONS=40 node ml/simulate_attacker_sessions.js
```

This drives real Chromium via Playwright against your local dev server and
measures real DOM events -- it does not fabricate numbers. Concretely, per
session it:

- Never moves the mouse (focuses inputs directly) -> real `mouseMovements = 0`.
- Never scrolls -> real `scrollEvents = 0`.
- Either types at bot speed (~15ms/keystroke, real `keydown` events fire, so
  `keystrokeAvgMs` is a real small measured average) or sets the input value
  directly via JS with no keyboard events at all (`keystrokeAvgMs = null`) --
  alternates between the two so both bot sophistication levels are
  represented, matching the `credential_stuffing_bot` archetype's ~40% null
  rate in the synthetic data.
- Submits 3 wrong passwords against your real share code (`failedPasswords`),
  or (for ~25% of sessions) guesses a random wrong 8-character share code
  instead and stops there (`failedCodes = 1`) -- two distinct, both
  realistic, attacker behaviours.
- Measures `requestsPerMinute` and `timeOnPageSeconds` from real
  `Date.now()` timestamps of its own real form submissions.
- Reads the real `navigator.userAgent` Playwright's Chromium reports and
  runs it through the same `SUSPICIOUS_AGENTS` substring check
  `src/lib/riskEngine.ts` uses, for `hasSuspiciousUA`.

Output: `ml/real_attacker_sessions.csv`, one row per session, `isAttacker=1`.

The script deliberately does **not** attempt to solve the app's captcha
challenge that appears after 3 failed password attempts -- these are
early-stage/probing attacker sessions, not full account-takeover attempts.
That's a real limitation of this dataset, noted in
`ml/PAPER_SECTIONS.md`.

## Part B -- legitimate sessions (manual, needs an actual human -- ~30-50 sessions)

This part cannot be scripted honestly: the entire point is to capture how a
real, unhurried human actually moves a mouse and types. Here's exactly what
to do, repeated ~30-50 times (varying your behaviour naturally is fine and
good -- different times of day, occasional real typos, maybe a couple of
sessions from your phone):

1. Open `http://localhost:3000/share` in a real browser tab.
2. Open DevTools (F12) -> Console tab.
3. Paste the entire contents of `ml/browser_console_logger.js` and press
   Enter. You'll see a confirmation log line.
4. Browse and unlock the file **naturally** -- as if you were an actual
   recipient: read the prompt, move your mouse normally, type at a normal
   pace with natural pauses, scroll if the page has content to scroll,
   don't rush. Occasionally (not every time) let yourself genuinely mistype
   the password once before getting it right -- that's realistic and some
   of the synthetic `legit_password_typo` archetype rows model exactly
   this.
5. Once you've successfully unlocked (or decided to stop), back in the
   console run:
   ```js
   window.__intellitrapLogSession({ failedPasswords: 0, failedCodes: 0 })
   ```
   (fill in the real counts if you mistyped anything).
6. It prints one CSV line. Copy it and append it as a new line in
   `ml/real_legitimate_sessions.csv` (the header row is already there).
7. Refresh the page and repeat from step 2 for the next session.

This is genuinely repetitive manual work -- that's the honest cost of real
human behavioural data, and it's fine (and worth saying in the paper) if you
end up with fewer than 50 sessions.

## A note on `isProxy` / `isHosting` / `previousBlocks`

Both collection paths hardcode these to `false` / `false` / `0`. This isn't
a simplification specific to this validation set -- tracing
`src/routes/share.tsx`'s call to `buildFeatures()`, the live app's
client-side risk computation **never passes these three fields either**;
`buildFeatures()` defaults them to `false`/`false`/`0` whenever they're
omitted, and `share.tsx` omits them. So every real production session
scored by `mlRiskEngine.ts` today has these three features pinned to the
same constants used here. That's a genuine finding worth stating plainly in
the paper's limitations section (see `ml/PAPER_SECTIONS.md`): 3 of the
model's 13 input features currently carry no signal in the deployed
client-side call site, and the real IP-reputation check (`assessRisk()`)
runs as a separate server-side signal merged in afterward rather than being
fed into the model itself.

## What happens next

Once you have both `ml/real_attacker_sessions.csv` (from Part A) and
`ml/real_legitimate_sessions.csv` (from Part B, with your appended rows),
run `ml/validate_real.py` (Step 10) to evaluate the trained model and the
rule-engine baseline against this real held-out set.
