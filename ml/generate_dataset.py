"""
generate_dataset.py
====================

*** THIS DATASET IS 100% SYNTHETIC. IT IS NOT REAL COLLECTED TRAFFIC. ***

IntelliTrap has no historical corpus of labeled attacker/legitimate sessions
(no production traffic logs, no red-team engagement data, no third-party
breach dataset was available to us at the time this was built). To train an
actual model instead of shipping hand-written if/else rules, we generate a
plausible labeled dataset from a hand-designed generative process:

  1. We define several "archetypes" of legitimate users (casual desktop,
     mobile/touch, a user who fat-fingers their password once) and several
     archetypes of attackers (credential-stuffing bot, content scraper,
     a careful human attacker who deliberately mimics normal behaviour,
     a repeat offender). Every archetype's feature distributions were
     chosen by us based on general security-domain intuition, NOT measured
     from real sessions.
  2. Each archetype samples its 13 features from independent parametric
     distributions (Normal/Poisson/Exponential/Bernoulli) with deliberate
     overlap across classes -- e.g. mobile legitimate users have very low
     mouse-movement counts (like bots), and the "careful human attacker"
     archetype has normal human typing/mouse behaviour (like legit users).
     This is intentional: it keeps the classification problem non-trivial
     and stops the label from being a trivial re-statement of any single
     feature threshold.
  3. ~4% of labels are randomly flipped after generation to simulate
     real-world label noise (analysts and heuristics misclassify some
     sessions even with real data).

Consequences you should disclose alongside any results trained on this data:
  - The model's accuracy/precision/recall numbers reflect how well it
    recovers the *rules we used to build the simulator*, not real-world
    attacker/legitimate separability. They are NOT a claim about real-world
    performance.
  - The feature distributions, correlations, and class balance are
    assumptions, not measurements. A production deployment of this model
    without retraining on real, reviewed session data would be inappropriate.
  - This approach is a reasonable engineering stand-in when no labeled
    corpus exists yet, and is commonly used to bootstrap a system before
    real telemetry accumulates -- but it must be labeled as synthetic in
    any write-up, paper, or dashboard that reports results derived from it.

Usage:
    python generate_dataset.py [--n 8000] [--seed 42] [--out dataset.csv]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "failedPasswords",
    "failedCodes",
    "requestsPerMinute",
    "mouseMovements",
    "keystrokeAvgMs",
    "isProxy",
    "isHosting",
    "hasSuspiciousUA",
    "isOffHoursIST",
    "previousBlocks",
    "timeOnPageSeconds",
    "scrollEvents",
    "pageViews",
]


def _clip_nonneg(arr: np.ndarray) -> np.ndarray:
    return np.clip(arr, 0, None)


def _sample_archetype(rng: np.random.Generator, n: int, spec: dict) -> pd.DataFrame:
    """Draw n sessions from one archetype's independent per-feature distributions."""
    failed_passwords = _clip_nonneg(
        rng.poisson(spec["failedPasswords_lambda"], size=n) + spec["failedPasswords_floor"]
    )
    failed_codes = _clip_nonneg(
        rng.poisson(spec["failedCodes_lambda"], size=n) + spec["failedCodes_floor"]
    )
    requests_per_minute = np.round(
        _clip_nonneg(rng.normal(spec["rpm_mean"], spec["rpm_sd"], size=n))
    )
    mouse_movements = _clip_nonneg(
        rng.poisson(spec["mouse_lambda"], size=n)
        if spec["mouse_dist"] == "poisson"
        else rng.normal(spec["mouse_mean"], spec["mouse_sd"], size=n)
    ).round()

    keystroke = rng.normal(spec["keystroke_mean"], spec["keystroke_sd"], size=n)
    keystroke = np.clip(keystroke, 15, None)
    keystroke_null_mask = rng.random(n) < spec["keystroke_null_prob"]
    keystroke = np.where(keystroke_null_mask, np.nan, np.round(keystroke, 1))

    is_proxy = rng.random(n) < spec["proxy_prob"]
    is_hosting = rng.random(n) < spec["hosting_prob"]
    has_suspicious_ua = rng.random(n) < spec["ua_prob"]
    is_off_hours = rng.random(n) < spec["offhours_prob"]

    previous_blocks = _clip_nonneg(
        rng.poisson(spec["prevblocks_lambda"], size=n)
    )

    time_on_page = _clip_nonneg(
        rng.exponential(spec["time_scale"], size=n) + spec["time_floor"]
    )
    scroll_events = _clip_nonneg(rng.poisson(spec["scroll_lambda"], size=n))
    page_views = _clip_nonneg(rng.poisson(spec["pageviews_lambda"], size=n) + 1)

    return pd.DataFrame(
        {
            "failedPasswords": failed_passwords.astype(int),
            "failedCodes": failed_codes.astype(int),
            "requestsPerMinute": requests_per_minute.astype(int),
            "mouseMovements": mouse_movements.astype(int),
            "keystrokeAvgMs": keystroke,
            "isProxy": is_proxy,
            "isHosting": is_hosting,
            "hasSuspiciousUA": has_suspicious_ua,
            "isOffHoursIST": is_off_hours,
            "previousBlocks": previous_blocks.astype(int),
            "timeOnPageSeconds": np.round(time_on_page, 1),
            "scrollEvents": scroll_events.astype(int),
            "pageViews": page_views.astype(int),
            "isAttacker": spec["label"],
            "scenario": spec["name"],
        }
    )


# Archetype specs. Weights are the share of the dataset each archetype gets
# (within its label group). All numeric parameters below are hand-chosen
# assumptions -- see module docstring.
LEGIT_ARCHETYPES = [
    dict(
        name="casual_legit",
        weight=0.55,
        label=0,
        failedPasswords_lambda=0.15,
        failedPasswords_floor=0,
        failedCodes_lambda=0.05,
        failedCodes_floor=0,
        rpm_mean=3.0,
        rpm_sd=1.6,
        mouse_dist="normal",
        mouse_mean=180,
        mouse_sd=65,
        mouse_lambda=None,
        keystroke_mean=225,
        keystroke_sd=45,
        keystroke_null_prob=0.05,
        proxy_prob=0.04,
        hosting_prob=0.01,
        ua_prob=0.01,
        offhours_prob=0.15,
        prevblocks_lambda=0.02,
        time_scale=35,
        time_floor=5,
        scroll_lambda=9,
        pageviews_lambda=1.5,
    ),
    dict(
        name="mobile_legit",
        weight=0.25,
        label=0,
        failedPasswords_lambda=0.2,
        failedPasswords_floor=0,
        failedCodes_lambda=0.08,
        failedCodes_floor=0,
        rpm_mean=2.5,
        rpm_sd=1.4,
        mouse_dist="normal",
        # Touch devices barely fire mousemove events -- overlaps with bots.
        mouse_mean=15,
        mouse_sd=14,
        mouse_lambda=None,
        keystroke_mean=290,
        keystroke_sd=55,
        keystroke_null_prob=0.15,
        proxy_prob=0.06,
        hosting_prob=0.01,
        ua_prob=0.02,
        offhours_prob=0.22,
        prevblocks_lambda=0.02,
        time_scale=30,
        time_floor=4,
        scroll_lambda=6,
        pageviews_lambda=1.2,
    ),
    dict(
        name="legit_password_typo",
        weight=0.12,
        label=0,
        failedPasswords_lambda=1.1,
        failedPasswords_floor=0,
        failedCodes_lambda=0.15,
        failedCodes_floor=0,
        rpm_mean=4.0,
        rpm_sd=2.0,
        mouse_dist="normal",
        mouse_mean=160,
        mouse_sd=60,
        mouse_lambda=None,
        keystroke_mean=210,
        keystroke_sd=50,
        keystroke_null_prob=0.05,
        proxy_prob=0.05,
        hosting_prob=0.01,
        ua_prob=0.01,
        offhours_prob=0.17,
        prevblocks_lambda=0.05,
        time_scale=50,
        time_floor=8,
        scroll_lambda=10,
        pageviews_lambda=1.6,
    ),
    dict(
        name="legit_on_vpn",
        weight=0.08,
        label=0,
        # Privacy-conscious legitimate users on a VPN -- overlaps with proxy signal.
        failedPasswords_lambda=0.2,
        failedPasswords_floor=0,
        failedCodes_lambda=0.05,
        failedCodes_floor=0,
        rpm_mean=3.5,
        rpm_sd=1.8,
        mouse_dist="normal",
        mouse_mean=170,
        mouse_sd=60,
        mouse_lambda=None,
        keystroke_mean=230,
        keystroke_sd=45,
        keystroke_null_prob=0.05,
        proxy_prob=0.9,
        hosting_prob=0.05,
        ua_prob=0.02,
        offhours_prob=0.2,
        prevblocks_lambda=0.02,
        time_scale=38,
        time_floor=5,
        scroll_lambda=9,
        pageviews_lambda=1.5,
    ),
]

ATTACKER_ARCHETYPES = [
    dict(
        name="credential_stuffing_bot",
        weight=0.35,
        label=1,
        failedPasswords_lambda=3.0,
        failedPasswords_floor=1,
        failedCodes_lambda=0.6,
        failedCodes_floor=0,
        rpm_mean=25,
        rpm_sd=11,
        mouse_dist="poisson",
        mouse_mean=None,
        mouse_sd=None,
        mouse_lambda=0.4,
        keystroke_mean=35,
        keystroke_sd=14,
        keystroke_null_prob=0.4,
        proxy_prob=0.55,
        hosting_prob=0.5,
        ua_prob=0.6,
        offhours_prob=0.4,
        prevblocks_lambda=0.8,
        time_scale=1.5,
        time_floor=0.2,
        scroll_lambda=0.3,
        pageviews_lambda=0.5,
    ),
    dict(
        name="scraper_bot",
        weight=0.25,
        label=1,
        failedPasswords_lambda=0.3,
        failedPasswords_floor=0,
        failedCodes_lambda=0.1,
        failedCodes_floor=0,
        rpm_mean=35,
        rpm_sd=15,
        mouse_dist="poisson",
        mouse_mean=None,
        mouse_sd=None,
        mouse_lambda=0.6,
        keystroke_mean=40,
        keystroke_sd=20,
        keystroke_null_prob=0.6,
        proxy_prob=0.3,
        hosting_prob=0.7,
        ua_prob=0.8,
        offhours_prob=0.35,
        prevblocks_lambda=0.3,
        time_scale=2.0,
        time_floor=0.3,
        scroll_lambda=0.5,
        pageviews_lambda=14,
    ),
    dict(
        name="careful_human_attacker",
        weight=0.22,
        label=1,
        # Deliberately mimics normal human behaviour -- overlaps heavily with
        # legit archetypes on the behavioural-biometrics features.
        failedPasswords_lambda=2.2,
        failedPasswords_floor=1,
        failedCodes_lambda=1.8,
        failedCodes_floor=0,
        rpm_mean=8,
        rpm_sd=4,
        mouse_dist="normal",
        mouse_mean=150,
        mouse_sd=55,
        mouse_lambda=None,
        keystroke_mean=205,
        keystroke_sd=50,
        keystroke_null_prob=0.05,
        proxy_prob=0.5,
        hosting_prob=0.15,
        ua_prob=0.1,
        offhours_prob=0.45,
        prevblocks_lambda=0.5,
        time_scale=25,
        time_floor=4,
        scroll_lambda=7,
        pageviews_lambda=2.5,
    ),
    dict(
        name="repeat_offender",
        weight=0.18,
        label=1,
        failedPasswords_lambda=1.8,
        failedPasswords_floor=0,
        failedCodes_lambda=1.0,
        failedCodes_floor=0,
        rpm_mean=14,
        rpm_sd=8,
        mouse_dist="poisson",
        mouse_mean=None,
        mouse_sd=None,
        mouse_lambda=8,
        keystroke_mean=90,
        keystroke_sd=45,
        keystroke_null_prob=0.25,
        proxy_prob=0.6,
        hosting_prob=0.35,
        ua_prob=0.3,
        offhours_prob=0.4,
        prevblocks_lambda=2.2,
        time_scale=6,
        time_floor=1,
        scroll_lambda=2,
        pageviews_lambda=3,
    ),
]


def build_dataset(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    n_legit = round(n * 0.6)
    n_attacker = n - n_legit

    frames = []
    for group, total in ((LEGIT_ARCHETYPES, n_legit), (ATTACKER_ARCHETYPES, n_attacker)):
        weights = np.array([a["weight"] for a in group], dtype=float)
        weights /= weights.sum()
        counts = np.round(weights * total).astype(int)
        counts[-1] += total - counts.sum()  # fix rounding drift
        for spec, count in zip(group, counts):
            if count <= 0:
                continue
            frames.append(_sample_archetype(rng, int(count), spec))

    df = pd.concat(frames, ignore_index=True)
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    # Simulate label noise: real-world ground truth is never perfectly clean.
    noise_rate = 0.04
    flip_mask = rng.random(len(df)) < noise_rate
    df.loc[flip_mask, "isAttacker"] = 1 - df.loc[flip_mask, "isAttacker"]

    df["isAttacker"] = df["isAttacker"].astype(int)
    for col in ["isProxy", "isHosting", "hasSuspiciousUA", "isOffHoursIST"]:
        df[col] = df[col].astype(bool)

    return df[FEATURE_COLUMNS + ["isAttacker", "scenario"]]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic IntelliTrap risk-scoring dataset.")
    parser.add_argument("--n", type=int, default=8000, help="number of sessions to generate")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--out", type=str, default="dataset.csv", help="output CSV filename (relative to this script's directory)")
    args = parser.parse_args()

    df = build_dataset(args.n, args.seed)

    out_path = Path(__file__).parent / args.out
    df.to_csv(out_path, index=False)

    print(f"Wrote {len(df)} rows to {out_path}")
    print(f"Label balance: {df['isAttacker'].value_counts(normalize=True).to_dict()}")
    print("Scenario counts:")
    print(df["scenario"].value_counts())


if __name__ == "__main__":
    main()
