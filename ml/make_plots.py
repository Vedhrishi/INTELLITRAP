"""
make_plots.py

Generates confusion matrix, ROC curve, and feature importance plots (PNG)
for the trained model in ml/model.joblib. Run train.py first.
"""

from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import ConfusionMatrixDisplay, RocCurveDisplay, confusion_matrix

HERE = Path(__file__).parent


def plot_confusion_matrix(y_test, y_pred):
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=["legitimate", "attacker"])
    fig, ax = plt.subplots(figsize=(5, 5))
    disp.plot(ax=ax, cmap="Blues", colorbar=False)
    ax.set_title("RandomForestClassifier — Confusion Matrix (test set)")
    fig.tight_layout()
    fig.savefig(HERE / "confusion_matrix.png", dpi=150)
    plt.close(fig)


def plot_roc_curve(clf, X_test, y_test):
    fig, ax = plt.subplots(figsize=(5.5, 5))
    RocCurveDisplay.from_estimator(clf, X_test, y_test, ax=ax, name="RandomForest")
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="chance")
    ax.set_title("ROC Curve (test set)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(HERE / "roc_curve.png", dpi=150)
    plt.close(fig)


def plot_feature_importance(clf, feature_names):
    importances = clf.feature_importances_
    order = np.argsort(importances)[::-1]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh(
        [feature_names[i] for i in order][::-1],
        importances[order][::-1],
        color="#2563eb",
    )
    ax.set_xlabel("Gini importance")
    ax.set_title("Feature Importance — RandomForestClassifier")
    fig.tight_layout()
    fig.savefig(HERE / "feature_importance.png", dpi=150)
    plt.close(fig)


def main():
    bundle = joblib.load(HERE / "model.joblib")
    clf = bundle["clf"]
    X_test = bundle["X_test"]
    y_test = bundle["y_test"]
    y_pred = bundle["y_pred"]
    feature_names = bundle["feature_names"]

    plot_confusion_matrix(y_test, y_pred)
    plot_roc_curve(clf, X_test, y_test)
    plot_feature_importance(clf, feature_names)

    print("Wrote confusion_matrix.png, roc_curve.png, feature_importance.png")


if __name__ == "__main__":
    main()
