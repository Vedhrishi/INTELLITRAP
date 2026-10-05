"""
make_revision_assets.py

Produces the artefacts needed to answer the reviewers' requests for
(a) dataset size / class distribution / protocol, (b) clear high-resolution
figures, and (c) how the 0-100 risk score maps onto the four severity levels.

Everything is computed from ml/dataset.csv + ml/model.joblib (run train.py
first). Writes:
  ml/revision_stats.json              numbers quoted in REVISION_RESPONSE.md
  ml/figures/*.png (600 dpi) + *.pdf  vector/high-res figures for the paper
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    auc,
    confusion_matrix,
    roc_curve,
)
from sklearn.model_selection import train_test_split

from train import RANDOM_STATE, encode_features, run_rule_engine

HERE = Path(__file__).parent
FIG = HERE / "figures"
FIG.mkdir(exist_ok=True)

plt.rcParams.update(
    {
        "font.size": 11,
        "axes.titlesize": 12,
        "axes.labelsize": 11,
        "legend.fontsize": 10,
        "font.family": "DejaVu Sans",
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)

BLUE, ORANGE, GREY = "#1f4e9c", "#d55e00", "#777777"


def save(fig, name: str) -> None:
    fig.savefig(FIG / f"{name}.png", dpi=600, bbox_inches="tight")
    fig.savefig(FIG / f"{name}.pdf", bbox_inches="tight")
    plt.close(fig)


def level_for_score(score: float) -> str:
    # Mirrors levelForScore() in src/lib/riskEngine.ts
    return "low" if score <= 30 else "medium" if score <= 60 else "high" if score <= 80 else "critical"


def main() -> None:
    df = pd.read_csv(HERE / "dataset.csv")
    bundle = joblib.load(HERE / "model.joblib")
    clf = bundle["clf"]
    X_test, y_test = bundle["X_test"], bundle["y_test"]
    y_pred, y_proba = bundle["y_pred"], bundle["y_proba"]
    names = bundle["feature_names"]

    X = encode_features(df)
    y = df["isAttacker"].to_numpy()
    _, _, y_train, _, df_train, df_test = train_test_split(
        X, y, df, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    # ---- dataset / protocol statistics ------------------------------------
    stats: dict = {
        "n_total": int(len(df)),
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "class_counts_total": {"legitimate": int((y == 0).sum()), "attacker": int((y == 1).sum())},
        "class_counts_train": {"legitimate": int((y_train == 0).sum()), "attacker": int((y_train == 1).sum())},
        "class_counts_test": {"legitimate": int((y_test == 0).sum()), "attacker": int((y_test == 1).sum())},
        "scenario_counts_before_label_noise": df["scenario"].value_counts().to_dict(),
        "label_noise_rate": 0.04,
        "keystroke_missing_fraction": float(df["keystrokeAvgMs"].isna().mean()),
    }

    # ---- score -> severity level mapping on the held-out test set ----------
    score = np.round(y_proba * 100).astype(int)
    levels = pd.Series([level_for_score(s) for s in score], name="level")
    order = ["low", "medium", "high", "critical"]
    tab = pd.DataFrame({"level": levels, "y": y_test})
    stats["severity_levels_test"] = {
        lv: {
            "n": int((tab.level == lv).sum()),
            "attacker_fraction": float(tab.loc[tab.level == lv, "y"].mean()) if (tab.level == lv).any() else None,
        }
        for lv in order
    }

    # ---- feature importance -------------------------------------------------
    imp = clf.feature_importances_
    stats["gini_importance"] = {n: float(v) for n, v in sorted(zip(names, imp), key=lambda t: -t[1])}

    # ---- rule baseline on same rows ----------------------------------------
    rr = df_test.apply(run_rule_engine, axis=1, result_type="expand")
    rr.columns = ["decision", "score"]
    rule_pred = (rr["decision"] != "granted").astype(int).to_numpy()
    rule_score = rr["score"].to_numpy() / 100.0

    json.dump(stats, open(HERE / "revision_stats.json", "w"), indent=2)

    # ---- Figure 1: ROC, both models ----------------------------------------
    fig, ax = plt.subplots(figsize=(5.2, 4.8))
    for label, s, colour in (
        ("Trained Random Forest", y_proba, BLUE),
        ("Rule-based baseline", rule_score, ORANGE),
    ):
        fpr, tpr, _ = roc_curve(y_test, s)
        ax.plot(fpr, tpr, color=colour, lw=2, label=f"{label} (AUC = {auc(fpr, tpr):.3f})")
    ax.plot([0, 1], [0, 1], ls="--", color=GREY, lw=1, label="Chance")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title(f"ROC curve, held-out synthetic test set (n = {len(y_test)})")
    ax.legend(loc="lower right", frameon=False)
    ax.grid(alpha=0.25)
    save(fig, "fig_roc")

    # ---- Figure 2: confusion matrices side by side -------------------------
    fig, axes = plt.subplots(1, 2, figsize=(9, 4.2))
    for ax, (title, pred) in zip(axes, (("Trained Random Forest", y_pred), ("Rule-based baseline", rule_pred))):
        ConfusionMatrixDisplay(
            confusion_matrix(y_test, pred), display_labels=["Legitimate", "Attacker"]
        ).plot(ax=ax, cmap="Blues", colorbar=False, values_format="d")
        ax.set_title(title)
        ax.grid(False)
    fig.suptitle(f"Confusion matrices, held-out synthetic test set (n = {len(y_test)})", y=1.02)
    fig.tight_layout()
    save(fig, "fig_confusion")

    # ---- Figure 3: feature importance --------------------------------------
    order_idx = np.argsort(imp)
    fig, ax = plt.subplots(figsize=(6.5, 5))
    ax.barh([names[i] for i in order_idx], imp[order_idx], color=BLUE)
    ax.set_xlabel("Mean decrease in Gini impurity")
    ax.set_title("Feature importance, 15-tree Random Forest")
    ax.grid(axis="x", alpha=0.25)
    save(fig, "fig_feature_importance")

    # ---- Figure 4: score distribution and the four severity bands ----------
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    bins = np.linspace(0, 100, 41)
    ax.hist(score[y_test == 0], bins=bins, alpha=0.75, color=BLUE, label="Legitimate")
    ax.hist(score[y_test == 1], bins=bins, alpha=0.75, color=ORANGE, label="Attacker")
    for x, lbl in ((30.5, "Low | Medium"), (60.5, "Medium | High"), (80.5, "High | Critical")):
        ax.axvline(x, color="k", ls=":", lw=1)
        ax.text(x, ax.get_ylim()[1] * 0.97, lbl, rotation=90, va="top", ha="right", fontsize=8)
    ax.set_xlabel("Risk score (100 x mean attacker probability over 15 trees)")
    ax.set_ylabel("Test sessions")
    ax.set_title("Risk-score distribution and severity-level boundaries")
    ax.legend(frameon=False, loc="center", bbox_to_anchor=(0.5, 0.62))
    save(fig, "fig_score_levels")

    print("Wrote ml/revision_stats.json and ml/figures/*.png|pdf")
    print(json.dumps({k: stats[k] for k in ("class_counts_total", "class_counts_train", "class_counts_test", "severity_levels_test")}, indent=2))


if __name__ == "__main__":
    main()
