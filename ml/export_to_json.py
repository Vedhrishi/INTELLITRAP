"""
export_to_json.py

Exports the trained RandomForestClassifier (ml/model.joblib) as a compact,
plain-JSON description of its tree splits -- no pickles, no binary formats --
so the web app can walk the trees in pure TypeScript with zero runtime
dependencies. Writes src/lib/model_forest.json.

For every node (internal AND leaf) we export the model's estimated
P(attacker) at that node (`value`), not just the leaf prediction. This lets
the TypeScript side compute per-feature contributions via the Saabas method
(contribution of a feature = sum, over the decision path, of the change in
P(attacker) caused by splitting on it) -- a real explanation derived from the
trained trees, rather than a hand-written "if failedPasswords > 2, +12
points" rule.
"""

import json
from pathlib import Path

import joblib

HERE = Path(__file__).parent
OUT_PATH = HERE.parent / "src" / "lib" / "model_forest.json"

ROUND_DP = 4


def export_tree(tree) -> dict:
    n = tree.node_count
    feature = []
    threshold = []
    left = []
    right = []
    value = []
    for i in range(n):
        is_leaf = tree.children_left[i] == tree.children_right[i] == -1
        feature.append(-1 if is_leaf else int(tree.feature[i]))
        threshold.append(None if is_leaf else round(float(tree.threshold[i]), ROUND_DP))
        left.append(int(tree.children_left[i]))
        right.append(int(tree.children_right[i]))
        counts = tree.value[i][0]  # [count_class0, count_class1]
        p_attacker = float(counts[1] / counts.sum())
        value.append(round(p_attacker, ROUND_DP))
    return {"feature": feature, "threshold": threshold, "left": left, "right": right, "value": value}


def main() -> None:
    bundle = joblib.load(HERE / "model.joblib")
    clf = bundle["clf"]
    feature_names = bundle["feature_names"]

    forest = {
        "featureNames": feature_names,
        "nEstimators": clf.n_estimators,
        "trees": [export_tree(est.tree_) for est in clf.estimators_],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(forest, fh, separators=(",", ":"))

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB)")
    if size_kb > 300:
        raise SystemExit(f"model_forest.json is {size_kb:.1f} KB, over the 300 KB budget")


if __name__ == "__main__":
    main()
