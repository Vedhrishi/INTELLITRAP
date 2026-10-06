# Revision pack: "Revise and Resubmit"

Paper: *An AI-Driven Adaptive Honeypot Framework for Intelligent Cloud Threat Detection and Automated Risk Response*

Everything below is derived from the code in this repo (file paths given so you can verify). Numbers come from `ml/metrics.json` and `ml/revision_stats.json` (regenerate with `python ml/train.py && python ml/make_revision_assets.py`). Copy the **Replacement text** blocks into your paper; the **Response to reviewers** table can go into your cover letter.

## 0. Read this first: claims in the paper that the code does NOT support

Reviewers are probing exactly these gaps. Fix the wording rather than defend the claim.

| Paper claim | What the repo actually does | Recommended wording |
|---|---|---|
| Detects "brute force, injection, scanning, malicious file uploads" (R1.5) | **Now implemented as a hybrid.** The Random Forest detects attacker behaviour (brute force, scanning via failed-login and request-rate features). `src/lib/threatClassifier.ts` adds signature detection of SQL injection, XSS, path traversal, command injection and malicious uploads (see `ml/THREAT_CLASSIFIER.md`; 90/91 payloads and 33/33 uploads correct on an author-written corpus). | Describe as hybrid: learned behavioural model plus signature module. Only the forest is machine learning. |
| "Permanently restricted" / irreversible blocks (R1.4) | `blocked_ips` rows have `is_active`, `unblocked_at`, `unblocked_by`; admins can lift a block. Admins are notified on every auto-block. | "Persistent IP block, enforced until an administrator reviews and lifts it." |
| Decoys "dynamically generated, randomized per session" (R1.2) | `src/lib/decoyGenerator.ts`: 8 categories x 4 file names, one content template per category (only export date varies), random file name and fake size (200 KB to 4 MB). **Now also biased by attacker behaviour** (password guessers get credential/source-code lures, code enumerators get customer/HR data, high-rate scanners get source/financial lures). | Describe as template-based, behaviour-biased, randomised selection (see 2). Content is still not generated text. |
| Four severity levels | `src/config/security.ts` was aligned to the live engine: 0-30 / 31-60 / 61-80 / 81-100 (DB seed settings 31/61/81 already agree). | Report these bands. |
| Results table 2 (real data) | `ml/real_legitimate_sessions.csv` has a header row only; `metrics.json` says `not_yet_collected`. | Either run `ml/collect_real_sessions.md` or state clearly that evaluation is on synthetic data. Never fill the table by hand. |
| Hyperparameter tuning / feature selection (R2.3) | Neither was performed: hyperparameters fixed (15 trees, depth 6, min leaf 15, seed 42), all 14 encoded features used. | State this plainly (see 5). Optionally run a grid search and report it. |

## 1. Attacker profile: features, weighting, validation (R1.1)

**Replacement text.**
The attacker profile has two layers. (i) A server-side rule-weighted score (`scoreVisitor`, `src/lib/tracking/tracking.server.ts`) sums fixed, hand-assigned points per signal, capped at 100 (Table A). (ii) A client-side Random Forest learns its own weighting from data; Gini importances are in Table B and Fig. 3. At decision time the **stricter** of the two verdicts wins, so the client can never relax a server verdict (`src/routes/share.tsx`).

*Table A. Server-side signal weights (points added to score)*

| Group | Signal | Points |
|---|---|---|
| Login behaviour | Failed password | 12 per failure, max 35 |
| | Invalid share code (beyond the first) | 15 per failure, max 30 |
| | Previously blocked / honeypotted (IP history) | 12 per block (max 25) / 8 per event (max 16) |
| Network / IP | Datacenter (hosting) IP | 22 |
| | Proxy or VPN (if not hosting) | 15 |
| | Blacklisted IP | 40 (whitelisted IP forces score 0) |
| Device / client | Automation user-agent (curl, selenium, ...) | 25 |
| | Missing or <20-char user-agent | 15 |
| Behavioural | Requests in last 60 s: >30 / >15 | 20 / 10 |
| | Mouse <10 while >5 keystrokes | 18 |
| | Mean keystroke interval <40 ms | 15 |
| | No scrolling with >2 page views | 8 |
| Temporal | Off-hours (IST 00:00-06:00) | 8 |

*Table B. Learned importance (Gini, from `ml/revision_stats.json`)*: requestsPerMinute 0.306, scrollEvents 0.164, failedPasswords 0.156, timeOnPageSeconds 0.137, keystrokeAvgMs 0.084, previousBlocks 0.058, failedCodes 0.052, isHosting 0.022, mouseMovements 0.010, isProxy 0.006, remaining features below 0.003.

**Validation, stated honestly.** Table A weights are expert-assigned and were not statistically calibrated; Table B weights are learned but from synthetic data. Browser/device fingerprints are stored per visitor (`visitors.device_fingerprint`, screen, hardware concurrency, etc.) for forensics and the admin dashboard, but are **not** inputs to either score; only the user-agent string (automation flag) is. In the deployed client path `isProxy`, `isHosting` and `previousBlocks` are not passed into the Random Forest (they default to false/false/0), so its discrimination rests on the other ten features; the server score does use them. Say this in Limitations (it is already in `PAPER_SECTIONS.md`).

## 2. Decoy generation (R1.2)

**Replacement text.**
When a session is diverted to the honeypot, the system serves decoys from a template generator (`src/lib/decoyGenerator.ts`) that does not depend on database state. Eight lure categories (credentials, employee records, financial data, customer database, strategic plans, source code, medical records, company confidential) each hold four plausible file names and one content template formatted to match its file type (plain-text credential dump, CSV HR export, JSON customer export, SQL schema name, and so on). Per decoy, the generator randomly selects the file name within the category, assigns a random displayed size between 200 KB and 4 MB, stamps the current export date, and generates a unique ID. A session receives a set of decoys from distinct categories. Templates carry plausible structure (internal hostnames, ID schemes, Indian-rupee figures, regulatory notices) but contain only redacted or rotated values, so no real secret can leak. Every interaction is logged to `honeypot_activity` (action, decoy name, time spent) for attacker-intent analysis.

**Attack-specific selection (implemented).** `generateDecoySet(count, hint)` ranks categories by the session's behaviour: failed passwords -> credentials, source code; invalid share codes -> customer database, employee records; more than 10 requests/min -> source code, financial data; remaining slots are filled randomly from unused categories.

**Limits to disclose:** content is template-fixed per category rather than generated text, and decoy realism has not been evaluated with human or attacker studies.

## 3. Dataset size, class distribution, protocol (R1.3, R2.2, R2.5)

**Replacement text.**
*Dataset.* 8,000 labelled sessions generated by `ml/generate_dataset.py` (seed 42) from eight hand-designed archetypes with deliberately overlapping feature distributions, then 4% of labels randomly flipped to emulate annotation noise. Final class counts: 4,759 legitimate (59.5%) and 3,241 attacker (40.5%). Archetype counts before noise: casual desktop 2,640; mobile 1,200; password-typo 576; VPN user 384 (legitimate); credential-stuffing bot 1,120; scraper bot 800; careful human attacker 704; repeat offender 576 (attacker). 18.6% of sessions have no keystroke telemetry.

*Protocol.* Stratified 80/20 split (random_state 42): train 6,400 (3,807 / 2,593), test 1,600 (952 / 648). 5-fold stratified cross-validation on the training split only; the test set is used once. Metrics: accuracy, precision, recall, F1 (attacker = positive class, threshold 0.5) and ROC-AUC. The rule-based baseline is a line-for-line port of the original 15 hand-written trees, run on the identical test rows (`granted` = legitimate, any other decision = attacker; score/100 used for AUC).

*Results (test set, n = 1,600).* RF: accuracy 0.965, precision 0.968, recall 0.944, F1 0.956, AUC 0.968 (confusion matrix TN 932, FP 20, FN 36, TP 612). Baseline: accuracy 0.769, precision 0.989, recall 0.434, F1 0.603, AUC 0.969. 5-fold CV for RF: accuracy 0.953 +/- 0.003, F1 0.942 +/- 0.004, AUC 0.961 +/- 0.004.

*Important caveat to state in the paper.* All results are on synthetic data; they measure how well the model recovers the simulator's structure, not real-world detection rates. Real-session validation (Table 2 in `PAPER_SECTIONS.md`) is still pending. Because the generator and the evaluation share the same assumptions, avoid words like "verified" or "proven" for the accuracy figures.

## 4. Automatic blocking criteria (R1.4)

**Replacement text (formal definition).**
Let *p* be the mean attacker probability over the 15 trees and *s* = round(100p). The severity level is Low if s <= 30, Medium if 31-60, High if 61-80, Critical if s >= 81. The access decision is a majority vote over trees, each tree mapping its leaf probability p_t to: allow (p_t < 0.3), challenge with OTP (0.3-0.6), honeypot (0.6-0.8), block (>= 0.8). An IP is auto-blocked iff the final decision is **block**, where the final decision is the stricter of the client Random Forest verdict and the server rule-score verdict (server: score > 80 -> block). In addition, 5 wrong share passwords in one session (`BRUTE_FORCE_LIMIT`, `src/config/security.ts`) diverts the visitor to the honeypot. A block writes an active row to `blocked_ips` (trigger score, signals, geo and device snapshot), flags the visitor, and alerts all administrators; subsequent requests from that IP are refused while `is_active` is true. Whitelisted IPs are never blocked. The action is reversible by an administrator (`unblocked_by`, `unblocked_at`), and every block is recorded in the audit log.

**Known weakness to note:** blocking is per IP, so shared NATs/VPN exits can cause collateral blocks; the paper should list this as a limitation. There is no automatic expiry.

## 5. ML model, training, hyperparameters (R1.5, R2.1, R2.3)

**Replacement text.**
*Model.* `sklearn.ensemble.RandomForestClassifier` (scikit-learn 1.9.1), `n_estimators` = 15, `max_depth` = 6, `min_samples_leaf` = 15, Gini criterion, other parameters default, `random_state` = 42. Fifteen trees were chosen to match the application's per-tree vote schema; depth 6 keeps the exported model at 21.8 KB for client-side delivery. *No hyperparameter search was performed; settings were fixed a priori.* *No feature selection was performed:* all 13 raw features plus a `keystrokeMissing` indicator are used (keystroke interval is encoded as -1 when absent, plus the indicator, instead of mean imputation, to preserve the "no keystroke telemetry" signal typical of bots).

*Features (14):* failedPasswords, failedCodes, requestsPerMinute, mouseMovements, keystrokeAvgMs, isProxy, isHosting, hasSuspiciousUA, isOffHoursIST, previousBlocks, timeOnPageSeconds, scrollEvents, pageViews, keystrokeMissing.

*Deployment.* The fitted forest is exported to JSON and evaluated in TypeScript with no runtime dependencies; outputs match scikit-learn to four decimals on held-out rows. Explanations use Saabas path attribution summed over trees.

## 6. Risk score and the four severity levels (R2.4)

**Replacement text.**
risk score s = round(100 x (1/15) sum_t p_t), where p_t is the attacker proportion in the leaf reached in tree t. Levels: Low 0-30, Medium 31-60, High 61-80, Critical 81-100. On the 1,600 test sessions (`ml/revision_stats.json`): Low 943 sessions (3.3% attackers), Medium 40 (37.5%), High 56 (96.4%), Critical 561 (97.7%). The score distribution is strongly bimodal (Fig. 4), so few sessions fall in the middle bands. The level reflects the averaged score; the access decision uses a per-tree majority vote, so the two can occasionally differ near band edges. Report the table above as calibration evidence, and note these are synthetic-data figures.

## 7. Figures (R2.6)

Replaced with 600-dpi PNG and vector PDF in `ml/figures/`:

| File | Use |
|---|---|
| `fig_roc.(png\|pdf)` | ROC, RF vs baseline, with AUC in legend |
| `fig_confusion.(png\|pdf)` | Side-by-side confusion matrices |
| `fig_feature_importance.(png\|pdf)` | Gini importance |
| `fig_score_levels.(png\|pdf)` | Score histogram with the four severity boundaries |

In LaTeX/Word insert the **PDF** versions (vector, never blurry). If your template needs raster, use the 600-dpi PNG and do not resize it up. Do not reuse the old `ml/*.png` (150 dpi).

## 8. References (R2.7)

`ml/REFERENCES_25.md` holds 24 references. Verify every DOI/page range before submitting (they are from memory, no live lookup was done). Renumber citations in the text accordingly and delete any reference you do not cite.

## 9. Response to reviewers (for the cover letter)

| # | Comment | Response | Where |
|---|---|---|---|
| R1.1 | Profile weighting/validation | Added signal-weight table, learned importances, and an explicit statement that weights are expert-set / synthetic-learned. | Sec. 1 |
| R1.2 | Decoy mechanism | Described generator, categories, randomisation, logging, and limits. | Sec. 2 |
| R1.3 | Dataset/protocol | Reported size, class counts, archetypes, noise, split, CV, metrics definition. | Sec. 3 |
| R1.4 | Block criteria | Formal rule, thresholds, reversibility, audit; wording changed from "permanent". | Sec. 4 |
| R1.5 | Models/data/params | Full model spec; scope clarified as binary detection. | Sec. 5, 0 |
| R2.1 | Algorithm unspecified | Random Forest, parameters stated. | Sec. 5 |
| R2.2 | Dataset undescribed | Synthetic generator and statistics described. | Sec. 3 |
| R2.3 | Training/feature selection/hyperparameters | Described; states none were tuned/selected. | Sec. 5 |
| R2.4 | Risk score and 4 levels | Formula, bands, per-level test statistics. | Sec. 6 |
| R2.5 | Metric details | Protocol, confusion matrices, CV mean +/- std. | Sec. 3 |
| R2.6 | Blurry figures | Replaced with 600-dpi/vector figures. | Sec. 7 |
| R2.7 | >25 references | Reduced to 24. | Sec. 8 |

## 10. Before you submit (things only you can do)

1. Run the real-session protocol (`ml/collect_real_sessions.md`) and fill Table 2, or explicitly frame the paper as synthetic-data proof of concept.
2. Verify all references.
3. Remove or soften claims in section 0 that the code does not back.
