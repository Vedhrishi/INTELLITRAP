# Related Work

A note on method before the list: these citations come from my training
data, not a live literature search (I have no web/database access in this
session). I'm listing them in two confidence tiers and saying so explicitly,
per your instruction not to invent citations. **Before submission, verify
every entry below against the actual publication** (DOI, exact page numbers,
exact author order) -- treat this list as a well-informed starting point for
your own literature search, not as final, submission-ready references.

## High-confidence entries (well-established, frequently-cited work I'm confident exists as described)

1. **Breiman, L. (2001). "Random Forests." *Machine Learning*, 45(1), 5-32.**
   The foundational Random Forest paper. Not about bot/session detection --
   included because it's the methodological basis for this project's
   classifier (`sklearn.ensemble.RandomForestClassifier`, trained in
   `ml/train.py`). Worth citing for the algorithm itself, separately from
   the application-domain papers below.

2. **Killourhy, K. S., & Maxion, R. A. (2009). "Comparing Anomaly-Detection Algorithms for Keystroke Dynamics." *Proceedings of the IEEE/IFIP International Conference on Dependable Systems & Networks (DSN)*.**
   Benchmarks multiple anomaly-detection algorithms on keystroke-timing data
   for authentication. Directly relevant to this project's `keystrokeAvgMs`
   feature. Difference: their setting is a fixed 10-character password
   typed by ~50 subjects under lab conditions with many classical anomaly
   detectors compared head-to-head; this project uses keystroke timing as
   one of 13 features in a general session-risk classifier rather than a
   dedicated keystroke-dynamics authenticator, and evaluates on a much
   smaller, less controlled real-session set.

3. **Jorgensen, Z., & Yu, T. (2011). "On Mouse Dynamics as a Behavioral Biometric for Authentication." *Proceedings of the ACM Symposium on Information, Computer and Communications Security (ASIACCS)*.**
   Studies mouse-movement patterns as an authentication signal, including
   how easily they can be mimicked. Directly relevant to this project's
   `mouseMovements` feature and to the "careful human attacker" synthetic
   archetype in `ml/generate_dataset.py`, which was deliberately designed
   with normal mouse behavior to test whether the model still catches
   attackers who don't exhibit the obvious zero-mouse-movement signal --
   this echoes that paper's finding that mouse dynamics alone are
   spoofable/imperfect as a sole signal, which is part of why this project
   treats it as one of 13 features rather than the sole discriminator.

4. **Chandola, V., Banerjee, A., & Kumar, V. (2009). "Anomaly Detection: A Survey." *ACM Computing Surveys*, 41(3), Article 15.**
   The standard general-purpose anomaly-detection survey and taxonomy.
   Relevant as the framing reference for treating "attacker session" as an
   anomaly-detection problem. Difference: this project doesn't do
   unsupervised anomaly detection at all -- it's supervised binary
   classification against a labeled (synthetic, then real-validated)
   dataset, which sidesteps the survey's core challenge of not having
   labels, at the cost of the labels themselves being synthetic for the
   primary training set.

5. **Cao, Q., Yang, X., Yu, J., & Palow, C. (2014). "Uncovering Large Groups of Active Malicious Accounts in Online Social Networks." *Proceedings of the ACM Conference on Computer and Communications Security (CCS)*.**
   Facebook's SynchroTrap system: detects malicious accounts by clustering
   accounts with synchronized, loosely similar behavior at scale (millions
   of accounts), rather than scoring sessions individually. Useful contrast:
   this project scores a single session in isolation against a per-session
   feature vector, with no cross-session/cross-account correlation signal
   at all -- a real capability gap worth naming explicitly in Limitations
   / Future Work, since SynchroTrap-style correlation is exactly the kind
   of signal a coordinated credential-stuffing campaign would otherwise
   evade session-by-session scoring.

## Lower-confidence entries (topic and general framing are consistent with what I recall, but flagging real uncertainty on exact venue/year/author details -- verify before citing)

6. **Iliou, C., Kostoulas, T., Tsikrika, T., Katos, V., Vrochidis, S., & Kompatsiaris, I. -- "Detection of Advanced Web Bots by Combining Web Logs with Mouse Behavioural Biometrics." *ACM Digital Threats: Research and Practice (DTRAP)*, approx. 2021.**
   I'm confident this general line of work (CERTH group, combining server
   logs with mouse-biometric features for bot detection) exists; I am
   **not fully confident** in the exact title wording, year, or venue as
   given above -- verify directly before citing. If accurate, it's close
   in spirit to this project: combining behavioral features (mouse) with
   request-level signals (their web logs; this project's
   `requestsPerMinute`, `isHosting`, etc.) for bot/attacker detection.
   Difference: they appear to target sophisticated bots designed to evade
   detection specifically; this project's synthetic "careful human
   attacker" archetype gestures at that same evasion problem but the real
   validation set (Playwright-scripted) does not yet include a bot that
   deliberately mimics human mouse/keystroke timing to evade detection --
   a natural next step per `ml/PAPER_SECTIONS.md`'s Future Work section.

7. **Legg, P. A., Buckley, O., Goldsmith, M., & Creese, S. -- "Automated Insider Threat Detection System Using User and Role-Based Profile Assessment." *IEEE Systems Journal*, approx. 2017.**
   Closest match I have reasonable recall of to the "UEBA" (user and entity
   behavior analytics) framing you asked for -- note that "UEBA" itself is
   an industry/analyst term (originating with Gartner), not a term of art
   that I can confidently point to in a specific top-venue academic paper's
   own title; this insider-threat / behavioral-profiling literature is the
   closest academic neighbor. **Flagging real uncertainty** on the exact
   title/year/venue -- verify before citing. If accurate: it builds
   per-user/per-role behavioral profiles and flags deviation, at the
   individual-account and organizational level. Difference: this project
   has no notion of a persistent user identity or role at all -- every
   session is scored independently with no baseline of "normal for this
   specific user," which is a much weaker (but also much cheaper and
   privacy-lighter) signal than profile-based UEBA approaches. Worth
   naming as a concrete direction: adding a per-visitor (not per-session)
   behavioral baseline, using `previousBlocks`-style history more
   substantively than the current constant-zero default (see the
   `isProxy`/`isHosting`/`previousBlocks` finding in
   `ml/collect_real_sessions.md`).

## How this project fits in, overall

Most of the above either (a) study one behavioral signal in isolation under
lab conditions (keystroke or mouse dynamics papers), or (b) operate at a
different scale/unit of analysis than a single session (SynchroTrap's
cross-account clustering, UEBA's per-user profiling). This project's
contribution is narrower and more practical: **distilling a hand-written,
15-rule heuristic risk engine into a small (15-tree, <25KB) trained Random
Forest that reproduces the same output contract**, trained on a labeled
synthetic dataset built to have realistic feature overlap between classes
(not the trivial separability of the original rules), and then honestly
validated against a small real-session set collected with the app itself
rather than assumed to generalize from synthetic data alone. It does not
claim state-of-the-art bot detection; it claims a measurable, honestly-
reported improvement (see `ml/metrics.json`) over the specific rule-based
system it replaces, with a proof-of-concept level of real-world validation.
