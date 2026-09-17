"""
validate_real.py

Evaluates the trained RandomForestClassifier (ml/model.joblib) AND the
reimplemented rule-engine baseline against the small REAL session set
collected via ml/collect_real_sessions.md (ml/real_attacker_sessions.csv +
ml/real_legitimate_sessions.csv), reporting results honestly -- including if
the trained model performs worse here than on the synthetic test set.

This is intentionally kept separate from ml/train.py's synthetic evaluation:
results are written under metrics.json's "real_data_validation" key so
synthetic and real numbers are never conflated in the same figure.

Run after completing ml/collect_real_sessions.md. Safe to run with only one
of the two CSVs populated (reports what class balance you actually have),
and safe to run with neither populated yet (prints instructions and exits
without touching metrics.json's other keys).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from train import (  # noqa: E402  (import after sys.path insert)
    RAW_FEATURES,
    encode_features,
    evaluate_binary,
    run_rule_engine,
)

ATTACKER_CSV = HERE / "real_attacker_sessions.csv"
LEGIT_CSV = HERE / "real_legitimate_sessions.csv"
BOOL_COLUMNS = ["isProxy", "isHosting", "hasSuspiciousUA", "isOffHoursIST"]


def _load_csv(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if df.empty:
        return None
    for col in BOOL_COLUMNS:
        # The JS collectors write lowercase JS booleans ("true"/"false"),
        # which pandas does not auto-coerce the way it does "True"/"False".
        df[col] = df[col].astype(str).str.strip().str.lower().map({"true": True, "false": False})
    return df


def load_real_dataset() -> pd.DataFrame | None:
    frames = [df for df in (_load_csv(ATTACKER_CSV), _load_csv(LEGIT_CSV)) if df is not None]
    if not frames:
        return None
    combined = pd.concat(frames, ignore_index=True)
    return combined[RAW_FEATURES + ["isAttacker", "scenario"]]


def safe_evaluate(y_true, y_pred, y_score, label: str) -> dict:
    """Wraps evaluate_binary(); real data may have only one class present
    (e.g. before both CSVs are collected), which breaks ROC-AUC -- report
    that honestly instead of crashing."""
    n_pos = int((y_true == 1).sum())
    n_neg = int((y_true == 0).sum())
    if n_pos == 0 or n_neg == 0:
        return {
            "warning": (
                f"{label}: only one class present in the real set so far "
                f"(legitimate={n_neg}, attacker={n_pos}) -- collect both "
                "ml/real_attacker_sessions.csv and ml/real_legitimate_sessions.csv "
                "rows before precision/recall/ROC-AUC are meaningful."
            ),
            "n_legitimate": n_neg,
            "n_attacker": n_pos,
        }
    return evaluate_binary(y_true, y_pred, y_score)


def main() -> None:
    metrics_path = HERE / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}

    real_df = load_real_dataset()
    if real_df is None:
        print(
            "No real session data found yet.\n"
            f"Expected data in {ATTACKER_CSV.name} and/or {LEGIT_CSV.name}.\n"
            "Follow ml/collect_real_sessions.md to generate it, then re-run this script."
        )
        metrics["real_data_validation"] = {
            "status": "not_yet_collected",
            "note": "See ml/collect_real_sessions.md. This key will be populated once "
            "ml/real_attacker_sessions.csv and/or ml/real_legitimate_sessions.csv have rows.",
        }
        metrics_path.write_text(json.dumps(metrics, indent=2, default=str))
        return

    n_legit = int((real_df["isAttacker"] == 0).sum())
    n_attacker = int((real_df["isAttacker"] == 1).sum())
    print(f"Loaded {len(real_df)} real sessions ({n_legit} legitimate, {n_attacker} attacker-like).")
    print("Scenario breakdown:")
    print(real_df["scenario"].value_counts().to_string())

    bundle = joblib.load(HERE / "model.joblib")
    clf = bundle["clf"]

    X_real = encode_features(real_df)
    y_real = real_df["isAttacker"].astype(int).to_numpy()

    y_pred = clf.predict(X_real)
    y_proba = clf.predict_proba(X_real)[:, 1]
    model_metrics = safe_evaluate(y_real, y_pred, y_proba, "trained model")

    rule_results = real_df.apply(run_rule_engine, axis=1, result_type="expand")
    rule_results.columns = ["decision", "score"]
    rule_pred = (rule_results["decision"] != "granted").astype(int).to_numpy()
    rule_score = (rule_results["score"] / 100.0).to_numpy()
    baseline_metrics = safe_evaluate(y_real, rule_pred, rule_score, "rule-engine baseline")
    if "warning" not in baseline_metrics:
        baseline_metrics["decision_breakdown"] = rule_results["decision"].value_counts().to_dict()

    print("\n--- Trained model on REAL data ---")
    print(json.dumps(model_metrics, indent=2, default=str))
    print("\n--- Rule-engine baseline on REAL data ---")
    print(json.dumps(baseline_metrics, indent=2, default=str))

    synthetic_model_acc = metrics.get("model", {}).get("test_set_metrics", {}).get("accuracy")
    real_model_acc = model_metrics.get("accuracy")
    if isinstance(synthetic_model_acc, (int, float)) and isinstance(real_model_acc, (int, float)):
        delta = real_model_acc - synthetic_model_acc
        direction = "WORSE" if delta < 0 else "better"
        print(
            f"\nReal-data accuracy is {abs(delta):.1%} {direction} than synthetic test "
            f"accuracy ({real_model_acc:.1%} vs {synthetic_model_acc:.1%})."
        )

    metrics["real_data_validation"] = {
        "status": "collected",
        "source": "ml/real_attacker_sessions.csv + ml/real_legitimate_sessions.csv (see ml/collect_real_sessions.md)",
        "n_sessions": len(real_df),
        "n_legitimate": n_legit,
        "n_attacker": n_attacker,
        "scenario_breakdown": real_df["scenario"].value_counts().to_dict(),
        "model": {"metrics": model_metrics},
        "baseline_rule_engine": {"metrics": baseline_metrics},
    }
    metrics_path.write_text(json.dumps(metrics, indent=2, default=str))
    print(f"\nWrote real_data_validation results to {metrics_path}")


if __name__ == "__main__":
    main()
