/**
 * Trained Random Forest risk engine.
 *
 * Walks a real scikit-learn RandomForestClassifier (15 trees, trained on
 * ml/dataset.csv, exported as plain JSON by ml/export_to_json.py) with no
 * runtime dependencies -- no TF.js, no ONNX runtime, just array indexing.
 *
 * Every tree emits its own local P(attacker) at the leaf reached; the
 * average across all 15 trees is `attackerProbability`. `score`, `level`,
 * `decision` and `treeVotes` are derived from that so the return shape
 * matches the legacy RiskResult from riskEngine.ts (see that file's header
 * for why it's kept around as the comparison baseline -- see
 * /ml/metrics.json for how the two compare).
 *
 * `breakdown`/`topSignals` are computed with the Saabas method: for each
 * tree, walking from root to leaf changes the tree's local P(attacker) at
 * every split; attributing that change to the feature that was split on and
 * summing across all trees gives a genuine, model-derived explanation of
 * which features pushed the score up (as opposed to a hand-written
 * threshold rule).
 */

import forestJson from "./model_forest.json";
import { levelForScore, type RiskDecision, type RiskFeatures, type RiskResult, type TreeVotes } from "./riskEngine";

interface ForestTree {
  feature: number[];
  threshold: (number | null)[];
  left: number[];
  right: number[];
  value: number[];
}

interface ForestModel {
  featureNames: string[];
  nEstimators: number;
  trees: ForestTree[];
}

const forest = forestJson as unknown as ForestModel;

export interface MlRiskResult extends RiskResult {
  attackerProbability: number;
}

const FEATURE_LABELS: Record<string, string> = {
  failedPasswords: "Failed passwords",
  failedCodes: "Multiple secret codes",
  requestsPerMinute: "High request rate",
  mouseMovements: "Low mouse activity",
  keystrokeAvgMs: "Inhuman typing speed",
  isProxy: "VPN/Proxy detected",
  isHosting: "Datacenter IP",
  hasSuspiciousUA: "Automation tool",
  isOffHoursIST: "Off-hours access (IST)",
  previousBlocks: "Previously blocked",
  timeOnPageSeconds: "Unusual time on page",
  scrollEvents: "No scroll activity",
  pageViews: "Unusual page view count",
  keystrokeMissing: "No keystroke telemetry",
};

/** Same encoding as ml/train.py's encode_features(). */
function buildFeatureMap(f: RiskFeatures): Record<string, number> {
  return {
    failedPasswords: f.failedPasswords,
    failedCodes: f.failedCodes,
    requestsPerMinute: f.requestsPerMinute,
    mouseMovements: f.mouseMovements,
    keystrokeAvgMs: f.keystrokeAvgMs === null ? -1 : f.keystrokeAvgMs,
    isProxy: f.isProxy ? 1 : 0,
    isHosting: f.isHosting ? 1 : 0,
    hasSuspiciousUA: f.hasSuspiciousUA ? 1 : 0,
    isOffHoursIST: f.isOffHoursIST ? 1 : 0,
    previousBlocks: f.previousBlocks,
    timeOnPageSeconds: f.timeOnPageSeconds,
    scrollEvents: f.scrollEvents,
    pageViews: f.pageViews,
    keystrokeMissing: f.keystrokeAvgMs === null ? 1 : 0,
  };
}

function walkTree(
  tree: ForestTree,
  x: number[],
): { leafProb: number; contributions: Record<string, number> } {
  const contributions: Record<string, number> = {};
  let node = 0;
  while (tree.feature[node] !== -1) {
    const featIdx = tree.feature[node];
    const threshold = tree.threshold[node] as number;
    const nextNode = x[featIdx] <= threshold ? tree.left[node] : tree.right[node];
    const featureName = forest.featureNames[featIdx];
    const delta = tree.value[nextNode] - tree.value[node];
    contributions[featureName] = (contributions[featureName] ?? 0) + delta;
    node = nextNode;
  }
  return { leafProb: tree.value[node], contributions };
}

/** Same 30/60/80 bands as levelForScore(), applied to one tree's local probability. */
function bucketForProbability(p: number): RiskDecision {
  if (p >= 0.8) return "blocked";
  if (p >= 0.6) return "honeypot";
  if (p >= 0.3) return "captcha_mfa";
  return "granted";
}

function buildBreakdown(contributions: Record<string, number>): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const [name, delta] of Object.entries(contributions)) {
    if (delta <= 0.01) continue;
    const label = FEATURE_LABELS[name] ?? name;
    breakdown[label] = Math.round(delta * 100);
  }
  return breakdown;
}

export function runMlRiskEngine(features: RiskFeatures): MlRiskResult {
  const featureMap = buildFeatureMap(features);
  const x = forest.featureNames.map((name) => featureMap[name]);

  const votes: TreeVotes = { granted: 0, captcha_mfa: 0, honeypot: 0, blocked: 0 };
  const totalContributions: Record<string, number> = {};
  let probSum = 0;

  for (const tree of forest.trees) {
    const { leafProb, contributions } = walkTree(tree, x);
    probSum += leafProb;
    votes[bucketForProbability(leafProb)] += 1;
    for (const [name, delta] of Object.entries(contributions)) {
      totalContributions[name] = (totalContributions[name] ?? 0) + delta;
    }
  }

  const attackerProbability = probSum / forest.trees.length;
  const score = Math.min(100, Math.max(0, Math.round(attackerProbability * 100)));
  const level = levelForScore(score);

  const ordered = (Object.entries(votes) as [RiskDecision, number][]).sort((a, b) => b[1] - a[1]);
  const decision: RiskDecision = ordered[0]?.[0] ?? "granted";
  const confidence = Math.round((votes[decision] / forest.trees.length) * 100);

  const breakdown = buildBreakdown(totalContributions);
  const topSignals = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  return {
    score,
    level,
    decision,
    breakdown,
    topSignals,
    confidence,
    treeVotes: votes,
    attackerProbability,
  };
}

export { buildFeatures } from "./riskEngine";
export type { RiskFeatures, RiskResult, RiskDecision } from "./riskEngine";
