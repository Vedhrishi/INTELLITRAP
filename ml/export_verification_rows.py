"""
export_verification_rows.py

Picks 10 sample sessions from the dataset (including some with null
keystrokeAvgMs) and computes the trained model's P(attacker) for each with
the Python/sklearn pipeline. Writes ml/verification_rows.json so the
TypeScript tree-walker (mlRiskEngine.ts) can be checked against these exact
values to 4 decimal places. One-off verification aid, not part of the
runtime app.
"""

import json
from pathlib import Path

import joblib
import pandas as pd

HERE = Path(__file__).parent


def encode_row(row: pd.Series, feature_names: list[str]) -> list[float]:
    keystroke_missing = 1 if pd.isna(row["keystrokeAvgMs"]) else 0
    keystroke = -1.0 if pd.isna(row["keystrokeAvgMs"]) else float(row["keystrokeAvgMs"])
    values = {
        "failedPasswords": float(row["failedPasswords"]),
        "failedCodes": float(row["failedCodes"]),
        "requestsPerMinute": float(row["requestsPerMinute"]),
        "mouseMovements": float(row["mouseMovements"]),
        "keystrokeAvgMs": keystroke,
        "isProxy": 1.0 if row["isProxy"] else 0.0,
        "isHosting": 1.0 if row["isHosting"] else 0.0,
        "hasSuspiciousUA": 1.0 if row["hasSuspiciousUA"] else 0.0,
        "isOffHoursIST": 1.0 if row["isOffHoursIST"] else 0.0,
        "previousBlocks": float(row["previousBlocks"]),
        "timeOnPageSeconds": float(row["timeOnPageSeconds"]),
        "scrollEvents": float(row["scrollEvents"]),
        "pageViews": float(row["pageViews"]),
        "keystrokeMissing": float(keystroke_missing),
    }
    return [values[name] for name in feature_names]


def main() -> None:
    bundle = joblib.load(HERE / "model.joblib")
    clf = bundle["clf"]
    feature_names = bundle["feature_names"]

    df = pd.read_csv(HERE / "dataset.csv")
    # Grab a mix: some with null keystrokeAvgMs, some without, across both labels.
    sample = pd.concat(
        [
            df[df["keystrokeAvgMs"].isna() & (df["isAttacker"] == 1)].head(3),
            df[df["keystrokeAvgMs"].isna() & (df["isAttacker"] == 0)].head(2),
            df[df["keystrokeAvgMs"].notna() & (df["isAttacker"] == 1)].head(3),
            df[df["keystrokeAvgMs"].notna() & (df["isAttacker"] == 0)].head(2),
        ]
    ).reset_index(drop=True)

    rows = []
    for _, row in sample.iterrows():
        x = encode_row(row, feature_names)
        proba = float(clf.predict_proba([x])[0][1])
        rows.append(
            {
                "features": {
                    "failedPasswords": int(row["failedPasswords"]),
                    "failedCodes": int(row["failedCodes"]),
                    "requestsPerMinute": int(row["requestsPerMinute"]),
                    "mouseMovements": int(row["mouseMovements"]),
                    "keystrokeAvgMs": None if pd.isna(row["keystrokeAvgMs"]) else float(row["keystrokeAvgMs"]),
                    "isProxy": bool(row["isProxy"]),
                    "isHosting": bool(row["isHosting"]),
                    "hasSuspiciousUA": bool(row["hasSuspiciousUA"]),
                    "isOffHoursIST": bool(row["isOffHoursIST"]),
                    "previousBlocks": int(row["previousBlocks"]),
                    "timeOnPageSeconds": float(row["timeOnPageSeconds"]),
                    "scrollEvents": int(row["scrollEvents"]),
                    "pageViews": int(row["pageViews"]),
                },
                "expected_attackerProbability": round(proba, 4),
            }
        )

    out_path = HERE / "verification_rows.json"
    with open(out_path, "w") as fh:
        json.dump(rows, fh, indent=2)
    print(f"Wrote {len(rows)} verification rows to {out_path}")
    for r in rows:
        print(r["expected_attackerProbability"], r["features"])


if __name__ == "__main__":
    main()
