"""
make_paper_figures.py

Single-column (3.32 in wide) 600-dpi images for the IEEE two-column paper:
two results tables rendered as images, the ROC curve, and the risk-score
distribution with the four severity bands. Run train.py first.
Outputs go to ml/figures/paper/.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from sklearn.metrics import auc, roc_curve

from train import encode_features, run_rule_engine  # noqa: F401  (run_rule_engine used below)
import pandas as pd
from sklearn.model_selection import train_test_split

HERE = Path(__file__).parent
OUT = HERE / "figures" / "paper"
OUT.mkdir(parents=True, exist_ok=True)
W = 3.32  # inches, one IEEE column

families = {f.name for f in font_manager.fontManager.ttflist}
SERIF = "Times New Roman" if "Times New Roman" in families else "DejaVu Serif"
plt.rcParams.update({"font.family": SERIF, "font.size": 7.5, "axes.spines.top": False, "axes.spines.right": False})

BLUE, ORANGE = "#1f4e9c", "#d55e00"


def table_png(name: str, header: list[str], rows: list[list[str]], col_w: list[float]) -> None:
    from matplotlib.patches import Rectangle

    n = len(rows) + 1
    row_h = 0.2
    fig = plt.figure(figsize=(W, row_h * n))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(n, 0)
    ax.axis("off")
    xs = np.concatenate([[0], np.cumsum(col_w)])
    for r, row in enumerate([header] + rows):
        fill = "#3a3a3a" if r == 0 else ("#f1f1f1" if r % 2 == 0 else "white")
        for c, cell in enumerate(row):
            ax.add_patch(Rectangle((xs[c], r), col_w[c], 1, facecolor=fill, edgecolor="#222222", linewidth=0.6))
            ax.text(
                xs[c] + 0.03, r + 0.52, cell, va="center", ha="left", fontsize=7.8,
                color="white" if r == 0 else "black", fontweight="bold" if r == 0 else "normal",
            )
    fig.savefig(OUT / name, dpi=600)
    plt.close(fig)


def main() -> None:
    m = json.load(open(HERE / "metrics.json"))
    rf = m["model"]["test_set_metrics"]
    rb = m["baseline_rule_engine"]["test_set_metrics"]
    cv = rf["cross_validation_5fold"]

    pct = lambda v: f"{100 * v:.1f}%"
    table_png(
        "table1.png",
        ["Metric", "Random Forest", "Rule-Based Baseline"],
        [
            ["Accuracy", pct(rf["accuracy"]), pct(rb["accuracy"])],
            ["Precision", pct(rf["precision"]), pct(rb["precision"])],
            ["Recall", pct(rf["recall"]), pct(rb["recall"])],
            ["F1-score", pct(rf["f1"]), pct(rb["f1"])],
            ["ROC-AUC", f"{rf['roc_auc']:.3f}", f"{rb['roc_auc']:.3f}"],
        ],
        [0.28, 0.34, 0.38],
    )
    table_png(
        "table2.png",
        ["Metric (5-fold CV)", "Mean ± SD"],
        [
            ["Accuracy", f"{pct(cv['accuracy']['mean'])} ± {100 * cv['accuracy']['std']:.1f}%"],
            ["Precision", f"{pct(cv['precision']['mean'])} ± {100 * cv['precision']['std']:.1f}%"],
            ["Recall", f"{pct(cv['recall']['mean'])} ± {100 * cv['recall']['std']:.1f}%"],
            ["F1-score", f"{pct(cv['f1']['mean'])} ± {100 * cv['f1']['std']:.1f}%"],
            ["ROC-AUC", f"{cv['roc_auc']['mean']:.3f} ± {cv['roc_auc']['std']:.3f}"],
        ],
        [0.5, 0.5],
    )

    bundle = joblib.load(HERE / "model.joblib")
    y_test, y_proba = bundle["y_test"], bundle["y_proba"]
    df = pd.read_csv(HERE / "dataset.csv")
    X = encode_features(df)
    y = df["isAttacker"].to_numpy()
    _, _, _, _, _, df_test = train_test_split(X, y, df, test_size=0.2, random_state=42, stratify=y)
    rr = df_test.apply(run_rule_engine, axis=1, result_type="expand")
    rule_score = rr[1].to_numpy() / 100.0

    # ROC
    fig, ax = plt.subplots(figsize=(W, 2.7))
    for label, s, col in (("Random Forest", y_proba, BLUE), ("Rule-based baseline", rule_score, ORANGE)):
        fpr, tpr, _ = roc_curve(y_test, s)
        ax.plot(fpr, tpr, color=col, lw=1.4, label=f"{label} (AUC = {auc(fpr, tpr):.3f})")
    ax.plot([0, 1], [0, 1], ls="--", color="grey", lw=0.8, label="Chance")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.legend(loc="lower right", frameon=False, fontsize=6.8)
    ax.grid(alpha=0.25, lw=0.4)
    fig.tight_layout(pad=0.4)
    fig.savefig(OUT / "fig_roc.png", dpi=600)
    plt.close(fig)

    # Score distribution
    score = np.round(y_proba * 100)
    fig, ax = plt.subplots(figsize=(W, 2.4))
    bins = np.linspace(0, 100, 41)
    ax.hist(score[y_test == 0], bins=bins, alpha=0.8, color=BLUE, label="Legitimate")
    ax.hist(score[y_test == 1], bins=bins, alpha=0.8, color=ORANGE, label="Attacker")
    for x, lab in ((30.5, "Low"), (60.5, "Medium"), (80.5, "High")):
        ax.axvline(x, color="k", ls=":", lw=0.8)
    ymax = ax.get_ylim()[1]
    for x, lab in ((15, "Low"), (45, "Medium"), (70, "High"), (90.5, "Critical")):
        ax.text(x, ymax * 0.96, lab, ha="center", va="top", fontsize=6.5)
    ax.set_xlabel("Risk score (0–100)")
    ax.set_ylabel("Test sessions")
    ax.legend(loc="center", bbox_to_anchor=(0.42, 0.62), frameon=False, fontsize=6.8)
    fig.tight_layout(pad=0.4)
    fig.savefig(OUT / "fig_score_levels.png", dpi=600)
    plt.close(fig)
    print("wrote", sorted(p.name for p in OUT.glob("*.png")), "font", SERIF)


if __name__ == "__main__":
    main()
