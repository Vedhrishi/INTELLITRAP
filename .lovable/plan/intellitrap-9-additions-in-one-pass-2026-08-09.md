# IntelliTrap — 9 additions in one pass

Scope: UI polish (storage bar, topbar), shared formatters, global CSS, a Random Forest risk engine with visible ML output, automatic decoy generation, and closing the loop so a "blocked" verdict really blocks the IP. Auth, uploads, sidebar structure and existing pages stay untouched. `/share` stays public.

## 1. Storage tab (Files → Storage)
- Progress bar colour by used percent: under 50% blue, under 80% amber, 80%+ red (bar fill only; existing layout kept).
- Keep "X.X MB / 1 GB" display via the shared file-size formatter.
- Above 90% of the 1 GB quota, show an amber warning card with an AlertTriangle icon and "Storage almost full. Delete old files to free space."

## 2. Secret code chip in the account dropdown
Below name/email in the topbar user menu: a "Your Secret Code" label, a monospace chip showing the profile's secret code (or an em dash), and a copy button that writes it to the clipboard and toasts "Secret code copied!".

## 3. Admin mode indicators
- Topbar, left of the avatar, for admins only: a pulsing red "ADMIN MODE" pill.
- Dropdown: a small amber crown beside the user name.
Admin status keeps coming from the existing role check — no new role storage.

## 4. Global CSS
Add a standard `spin` keyframe (only if absent) and thin 4px dark webkit scrollbar styling to the existing stylesheet.

## 5. `src/lib/formatters.ts`
A single import point that re-exports the existing helpers (`formatFileSize`, `toIST`) from the current format module, plus new `timeAgo` and `formatSeconds` helpers. No existing helper is rewritten, so nothing that already imports the old path changes behaviour.

## 6. Random Forest risk engine (`src/lib/riskEngine.ts`)
15 decision-tree functions over the specified feature set, majority vote for the decision, weighted vote score 0–100, level bands (low/medium/high/critical), confidence = winning vote share, a points breakdown, and top-3 signals. Plus `buildFeatures()` which derives suspicious-user-agent, off-hours-IST and requests-per-minute from raw session data.

`/share` integration: during the analyzing step, features are built from the live behaviour tracker snapshot plus failed password/code counts and request timestamps; `runRandomForest` decides the route (granted / challenge / honeypot / blocked). The existing server-side assessment still runs and still records telemetry — the forest result is used for routing and display, and the higher-risk of the two verdicts wins so the client cannot talk itself into access.

## 7. ML results display
- `/share`: the result is stored in state and a compact "Security Analysis" panel renders on granted, honeypot and blocked outcomes — score bar coloured by level, a 4-cell monospace grid of tree votes, model confidence, and amber chips for detected signals. The panel is identical on granted and honeypot so the honeypot stays indistinguishable.
- Admin → Threat Intelligence: a new "ML Analysis" panel showing a recharts radial gauge of the score with the number in the centre, and a Factor / Points table from the stored breakdown of the most recent analysed session.

## 8. Automatic decoy generation (`src/lib/decoyGenerator.ts`)
Eight categories with name lists, full content templates, mime types, and a plausible fake size. `generateDecoyFile()` and `generateDecoySet(3)` (distinct categories). `/share` honeypot switches from reading the decoy template table to generating a set locally, so decoys never fail on an empty table. Honeypot entry and each decoy download are still logged.

## 9. Risk score → real auto-block
- On a `blocked` verdict: the IP is upserted into the blocked list (auto type, RF reason and score, geo snapshot) and a `blocked` visitor event is written with score, decision, tree votes, signals and confidence. On a `honeypot` verdict: a `honeypot_entered` activity row with the same detail. These writes go through a new server function — the security tables reject anonymous client writes, so a browser insert would silently fail.
- `/share` mount check: if the current visitor's IP already has an active block, the page goes straight to the blocked state.
- Admin → Threat Intelligence: an "Auto-blocks today" counter (auto blocks since IST midnight), and each block row gains a large colour-coded RF score, a 4-column tree-vote grid, comma-separated top signals and confidence. The existing Lift Block action stays and continues to write an admin audit entry.
- Dashboard "IPs Blocked" KPI gains a sub-label: "N auto-blocked today".

## Technical notes
- Score→decision bands stay consistent with the existing thresholds config; the forest's own band edges (30/60/80) are used for the level label.
- Blocked-list upsert targets the existing unique IP constraint, so repeat offenders update rather than duplicate.
- All new queries handle null/error, all subscriptions clean up on unmount, empty states stay friendly, and the build must finish with zero TypeScript errors.
