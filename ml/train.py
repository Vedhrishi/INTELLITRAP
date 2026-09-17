"""
train.py

Trains a real scikit-learn RandomForestClassifier on ml/dataset.csv (see
generate_dataset.py for how that data was produced -- it is SYNTHETIC).

Also reimplements the existing hand-written rule engine
(src/lib/riskEngine.ts) faithfully in Python and evaluates it on the same
held-out test split, as a baseline comparison. The rule engine emits one of
four decisions (granted/captcha_mfa/honeypot/blocked); for a binary
attacker/legitimate comparison we treat "granted" as legitimate (0) and
everything else (captcha_mfa/honeypot/blocked) as attacker (1). Its 0-100
score is used as a pseudo-probability for ROC-AUC.

n_estimators is fixed at 15: the app's existing server-side validator
(tracking.functions.ts) caps each `tree_votes` field at 15, so the deployed
forest keeps that exact tree count to stay schema-compatible without a DB
migration. max_depth is limited to keep the exported JSON under the 300KB
budget (see export_to_json.py).

Writes ml/metrics.json with both models' metrics.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split

HERE = Path(__file__).parent

RAW_FEATURES = [
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

# Model-facing feature columns: keystrokeAvgMs is null for ~18% of sessions
# (RandomForestClassifier needs numeric input), so we encode it as a sentinel
# value plus an explicit "missing" flag rather than dropping/imputing it with
# a mean (which would blur the "no keystroke telemetry at all" signal that
# bots produce).
MODEL_FEATURES = RAW_FEATURES + ["keystrokeMissing"]

N_ESTIMATORS = 15
MAX_DEPTH = 6
MIN_SAMPLES_LEAF = 15
RANDOM_STATE = 42


def encode_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["keystrokeMissing"] = out["keystrokeAvgMs"].isna().astype(int)
    out["keystrokeAvgMs"] = out["keystrokeAvgMs"].fillna(-1.0)
    for col in ["isProxy", "isHosting", "hasSuspiciousUA", "isOffHoursIST"]:
        out[col] = out[col].astype(int)
    return out[MODEL_FEATURES]


# ---------------------------------------------------------------------------
# Faithful Python reimplementation of src/lib/riskEngine.ts
# ---------------------------------------------------------------------------

def _tree1(f):
    if f["failedPasswords"] >= 4:
        return "blocked"
    if f["failedPasswords"] >= 2 and f["isProxy"]:
        return "honeypot"
    if f["failedPasswords"] >= 2:
        return "captcha_mfa"
    if f["failedCodes"] >= 3:
        return "honeypot"
    return "granted"


def _tree2(f):
    if f["isHosting"] and f["failedPasswords"] > 0:
        return "blocked"
    if f["isHosting"]:
        return "honeypot"
    if f["isProxy"] and f["hasSuspiciousUA"]:
        return "honeypot"
    if f["isProxy"]:
        return "captcha_mfa"
    return "granted"


def _tree3(f):
    if f["mouseMovements"] == 0 and f["keystrokeAvgMs"] is not None and f["keystrokeAvgMs"] < 50:
        return "blocked"
    if f["mouseMovements"] == 0 and f["pageViews"] > 2:
        return "honeypot"
    if f["keystrokeAvgMs"] is not None and f["keystrokeAvgMs"] < 80:
        return "captcha_mfa"
    if f["scrollEvents"] == 0 and f["pageViews"] > 3:
        return "captcha_mfa"
    return "granted"


def _tree4(f):
    if f["hasSuspiciousUA"] and f["failedPasswords"] > 0:
        return "blocked"
    if f["hasSuspiciousUA"] and f["requestsPerMinute"] > 10:
        return "honeypot"
    if f["hasSuspiciousUA"]:
        return "captcha_mfa"
    return "granted"


def _tree5(f):
    if f["requestsPerMinute"] > 40:
        return "blocked"
    if f["requestsPerMinute"] > 20:
        return "honeypot"
    if f["requestsPerMinute"] > 10:
        return "captcha_mfa"
    return "granted"


def _tree6(f):
    if f["previousBlocks"] >= 2:
        return "blocked"
    if f["previousBlocks"] == 1 and f["failedPasswords"] > 0:
        return "honeypot"
    if f["previousBlocks"] == 1:
        return "captcha_mfa"
    return "granted"


def _tree7(f):
    if f["isOffHoursIST"] and f["failedPasswords"] >= 2:
        return "honeypot"
    if f["isOffHoursIST"] and f["hasSuspiciousUA"]:
        return "honeypot"
    if f["isOffHoursIST"]:
        return "captcha_mfa"
    return "granted"


def _tree8(f):
    bot_signals = sum(
        [
            f["mouseMovements"] < 5,
            f["scrollEvents"] == 0 and f["pageViews"] > 1,
            f["keystrokeAvgMs"] is not None and f["keystrokeAvgMs"] < 60,
            f["hasSuspiciousUA"],
            f["requestsPerMinute"] > 15,
        ]
    )
    if bot_signals >= 4:
        return "blocked"
    if bot_signals >= 3:
        return "honeypot"
    if bot_signals >= 2:
        return "captcha_mfa"
    return "granted"


def _tree9(f):
    if f["failedCodes"] >= 4:
        return "blocked"
    if f["failedCodes"] >= 3 and f["requestsPerMinute"] > 5:
        return "honeypot"
    if f["failedCodes"] >= 2:
        return "captcha_mfa"
    return "granted"


def _tree10(f):
    if f["timeOnPageSeconds"] < 2 and f["pageViews"] > 2:
        return "blocked"
    if f["timeOnPageSeconds"] < 5 and f["failedPasswords"] > 0:
        return "honeypot"
    if f["pageViews"] > 10 and f["mouseMovements"] < 20:
        return "captcha_mfa"
    return "granted"


def _tree11(f):
    if f["isHosting"] and f["requestsPerMinute"] > 5:
        return "blocked"
    if f["failedPasswords"] >= 3 and f["mouseMovements"] < 10:
        return "honeypot"
    if f["failedCodes"] >= 2 and f["isProxy"]:
        return "captcha_mfa"
    return "granted"


def _tree12(f):
    if f["previousBlocks"] >= 3:
        return "blocked"
    if f["hasSuspiciousUA"] and f["isOffHoursIST"]:
        return "honeypot"
    if f["failedPasswords"] >= 2 and f["keystrokeAvgMs"] is not None and f["keystrokeAvgMs"] < 100:
        return "captcha_mfa"
    return "granted"


def _tree13(f):
    score = (
        f["failedPasswords"] * 2
        + f["failedCodes"] * 1.5
        + (3 if f["isProxy"] else 0)
        + (4 if f["isHosting"] else 0)
        + (3 if f["hasSuspiciousUA"] else 0)
    )
    if score >= 8:
        return "blocked"
    if score >= 5:
        return "honeypot"
    if score >= 3:
        return "captcha_mfa"
    return "granted"


def _tree14(f):
    if f["requestsPerMinute"] > 30 and f["mouseMovements"] < 5:
        return "blocked"
    if f["failedPasswords"] >= 2 and f["scrollEvents"] == 0:
        return "honeypot"
    if f["isProxy"] or f["isOffHoursIST"]:
        return "captcha_mfa"
    return "granted"


def _tree15(f):
    high_risk = f["failedPasswords"] >= 3 or f["requestsPerMinute"] > 25 or (f["isHosting"] and f["hasSuspiciousUA"])
    med_risk = f["failedPasswords"] >= 1 or f["isProxy"] or f["failedCodes"] >= 2
    if high_risk and med_risk:
        return "blocked"
    if high_risk:
        return "honeypot"
    if med_risk:
        return "captcha_mfa"
    return "granted"


RULE_TREES = [
    _tree1, _tree2, _tree3, _tree4, _tree5, _tree6, _tree7, _tree8,
    _tree9, _tree10, _tree11, _tree12, _tree13, _tree14, _tree15,
]

DECISION_SCORES = {"granted": 0, "captcha_mfa": 35, "honeypot": 65, "blocked": 90}


def run_rule_engine(row: pd.Series) -> tuple[str, int]:
    """Returns (decision, score) exactly like runRandomForest() in riskEngine.ts."""
    f = {
        "failedPasswords": row["failedPasswords"],
        "failedCodes": row["failedCodes"],
        "requestsPerMinute": row["requestsPerMinute"],
        "mouseMovements": row["mouseMovements"],
        "keystrokeAvgMs": None if pd.isna(row["keystrokeAvgMs"]) else row["keystrokeAvgMs"],
        "isProxy": bool(row["isProxy"]),
        "isHosting": bool(row["isHosting"]),
        "hasSuspiciousUA": bool(row["hasSuspiciousUA"]),
        "isOffHoursIST": bool(row["isOffHoursIST"]),
        "previousBlocks": row["previousBlocks"],
        "timeOnPageSeconds": row["timeOnPageSeconds"],
        "scrollEvents": row["scrollEvents"],
        "pageViews": row["pageViews"],
    }
    votes = {"granted": 0, "captcha_mfa": 0, "honeypot": 0, "blocked": 0}
    for tree in RULE_TREES:
        votes[tree(f)] += 1
    score = min(
        100,
        round(
            (
                votes["captcha_mfa"] * DECISION_SCORES["captcha_mfa"]
                + votes["honeypot"] * DECISION_SCORES["honeypot"]
                + votes["blocked"] * DECISION_SCORES["blocked"]
            )
            / len(RULE_TREES)
        ),
    )
    decision = max(votes.items(), key=lambda kv: kv[1])[0]
    return decision, score


def evaluate_binary(y_true: np.ndarray, y_pred: np.ndarray, y_score: np.ndarray) -> dict:
    cm = confusion_matrix(y_true, y_pred).tolist()
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_score),
        "confusion_matrix": {
            "labels": ["legitimate (0)", "attacker (1)"],
            "matrix": cm,
        },
    }


def main() -> None:
    df = pd.read_csv(HERE / "dataset.csv")

    X = encode_features(df)
    y = df["isAttacker"].to_numpy()

    X_train, X_test, y_train, y_test, df_train, df_test = train_test_split(
        X, y, df, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    # 5-fold stratified cross-validation on the training split.
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_validate(
        clf,
        X_train,
        y_train,
        cv=cv,
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
        n_jobs=-1,
    )

    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    model_metrics = evaluate_binary(y_test, y_pred, y_proba)
    model_metrics["cross_validation_5fold"] = {
        metric: {"mean": float(np.mean(cv_scores[f"test_{metric}"])), "std": float(np.std(cv_scores[f"test_{metric}"]))}
        for metric in ["accuracy", "precision", "recall", "f1", "roc_auc"]
    }

    # Baseline: existing rule engine, run on the same test rows.
    rule_results = df_test.apply(run_rule_engine, axis=1, result_type="expand")
    rule_results.columns = ["decision", "score"]
    rule_pred = (rule_results["decision"] != "granted").astype(int).to_numpy()
    rule_score = (rule_results["score"] / 100.0).to_numpy()
    baseline_metrics = evaluate_binary(y_test, rule_pred, rule_score)
    baseline_metrics["decision_breakdown"] = rule_results["decision"].value_counts().to_dict()

    metrics = {
        "dataset": {
            "source": "ml/dataset.csv (SYNTHETIC, see generate_dataset.py header)",
            "n_total": len(df),
            "n_train": len(X_train),
            "n_test": len(X_test),
            "label_balance_total": df["isAttacker"].value_counts(normalize=True).to_dict(),
        },
        "model": {
            "type": "sklearn.ensemble.RandomForestClassifier",
            "hyperparameters": {
                "n_estimators": N_ESTIMATORS,
                "max_depth": MAX_DEPTH,
                "min_samples_leaf": MIN_SAMPLES_LEAF,
                "random_state": RANDOM_STATE,
            },
            "features": MODEL_FEATURES,
            "test_set_metrics": model_metrics,
        },
        "baseline_rule_engine": {
            "type": "reimplementation of src/lib/riskEngine.ts (15 hand-written decision trees)",
            "binary_mapping": "decision == 'granted' -> legitimate(0), else -> attacker(1); score/100 used as pseudo-probability for ROC-AUC",
            "test_set_metrics": baseline_metrics,
        },
    }

    with open(HERE / "metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2, default=str)

    print(json.dumps(metrics, indent=2, default=str))

    # Persist the fitted model + train/test split for downstream scripts
    # (export_to_json.py, make_plots.py) without retraining.
    import joblib

    joblib.dump(
        {
            "clf": clf,
            "X_train": X_train,
            "X_test": X_test,
            "y_train": y_train,
            "y_test": y_test,
            "y_pred": y_pred,
            "y_proba": y_proba,
            "feature_names": MODEL_FEATURES,
        },
        HERE / "model.joblib",
    )
    print(f"\nSaved fitted model + split to {HERE / 'model.joblib'}")


if __name__ == "__main__":
    main()
