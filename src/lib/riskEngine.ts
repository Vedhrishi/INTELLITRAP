/**
 * Random Forest style risk engine.
 *
 * Fifteen shallow decision trees each look at a different subset of the
 * behavioural / network features and vote for an access decision. The majority
 * vote wins, the vote spread becomes the 0-100 score and the winner's share is
 * reported as model confidence.
 */

export type RiskDecision = "granted" | "captcha_mfa" | "honeypot" | "blocked";

export interface RiskFeatures {
  failedPasswords: number;
  failedCodes: number;
  requestsPerMinute: number;
  mouseMovements: number;
  keystrokeAvgMs: number | null;
  isProxy: boolean;
  isHosting: boolean;
  hasSuspiciousUA: boolean;
  isOffHoursIST: boolean;
  previousBlocks: number;
  timeOnPageSeconds: number;
  scrollEvents: number;
  pageViews: number;
}

export interface TreeVotes {
  granted: number;
  captcha_mfa: number;
  honeypot: number;
  blocked: number;
}

export interface RiskResult {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  decision: RiskDecision;
  breakdown: Record<string, number>;
  topSignals: string[];
  confidence: number;
  treeVotes: TreeVotes;
}

/** Authentication failures. */
function tree1(f: RiskFeatures): RiskDecision {
  if (f.failedPasswords >= 4) return "blocked";
  if (f.failedPasswords >= 2 && f.isProxy) return "honeypot";
  if (f.failedPasswords >= 2) return "captcha_mfa";
  if (f.failedCodes >= 3) return "honeypot";
  return "granted";
}

/** Network characteristics. */
function tree2(f: RiskFeatures): RiskDecision {
  if (f.isHosting && f.failedPasswords > 0) return "blocked";
  if (f.isHosting) return "honeypot";
  if (f.isProxy && f.hasSuspiciousUA) return "honeypot";
  if (f.isProxy) return "captcha_mfa";
  return "granted";
}

/** Behavioural biometrics. */
function tree3(f: RiskFeatures): RiskDecision {
  if (f.mouseMovements === 0 && f.keystrokeAvgMs !== null && f.keystrokeAvgMs < 50)
    return "blocked";
  if (f.mouseMovements === 0 && f.pageViews > 2) return "honeypot";
  if (f.keystrokeAvgMs !== null && f.keystrokeAvgMs < 80) return "captcha_mfa";
  if (f.scrollEvents === 0 && f.pageViews > 3) return "captcha_mfa";
  return "granted";
}

/** User agent and tooling. */
function tree4(f: RiskFeatures): RiskDecision {
  if (f.hasSuspiciousUA && f.failedPasswords > 0) return "blocked";
  if (f.hasSuspiciousUA && f.requestsPerMinute > 10) return "honeypot";
  if (f.hasSuspiciousUA) return "captcha_mfa";
  return "granted";
}

/** Request velocity. */
function tree5(f: RiskFeatures): RiskDecision {
  if (f.requestsPerMinute > 40) return "blocked";
  if (f.requestsPerMinute > 20) return "honeypot";
  if (f.requestsPerMinute > 10) return "captcha_mfa";
  return "granted";
}

/** Repeat offences. */
function tree6(f: RiskFeatures): RiskDecision {
  if (f.previousBlocks >= 2) return "blocked";
  if (f.previousBlocks === 1 && f.failedPasswords > 0) return "honeypot";
  if (f.previousBlocks === 1) return "captcha_mfa";
  return "granted";
}

/** Temporal signals. */
function tree7(f: RiskFeatures): RiskDecision {
  if (f.isOffHoursIST && f.failedPasswords >= 2) return "honeypot";
  if (f.isOffHoursIST && f.hasSuspiciousUA) return "honeypot";
  if (f.isOffHoursIST) return "captcha_mfa";
  return "granted";
}

/** Combined bot signals. */
function tree8(f: RiskFeatures): RiskDecision {
  const botSignals = [
    f.mouseMovements < 5,
    f.scrollEvents === 0 && f.pageViews > 1,
    f.keystrokeAvgMs !== null && f.keystrokeAvgMs < 60,
    f.hasSuspiciousUA,
    f.requestsPerMinute > 15,
  ].filter(Boolean).length;

  if (botSignals >= 4) return "blocked";
  if (botSignals >= 3) return "honeypot";
  if (botSignals >= 2) return "captcha_mfa";
  return "granted";
}

/** Code enumeration. */
function tree9(f: RiskFeatures): RiskDecision {
  if (f.failedCodes >= 4) return "blocked";
  if (f.failedCodes >= 3 && f.requestsPerMinute > 5) return "honeypot";
  if (f.failedCodes >= 2) return "captcha_mfa";
  return "granted";
}

/** Session behaviour. */
function tree10(f: RiskFeatures): RiskDecision {
  if (f.timeOnPageSeconds < 2 && f.pageViews > 2) return "blocked";
  if (f.timeOnPageSeconds < 5 && f.failedPasswords > 0) return "honeypot";
  if (f.pageViews > 10 && f.mouseMovements < 20) return "captcha_mfa";
  return "granted";
}

function tree11(f: RiskFeatures): RiskDecision {
  if (f.isHosting && f.requestsPerMinute > 5) return "blocked";
  if (f.failedPasswords >= 3 && f.mouseMovements < 10) return "honeypot";
  if (f.failedCodes >= 2 && f.isProxy) return "captcha_mfa";
  return "granted";
}

function tree12(f: RiskFeatures): RiskDecision {
  if (f.previousBlocks >= 3) return "blocked";
  if (f.hasSuspiciousUA && f.isOffHoursIST) return "honeypot";
  if (f.failedPasswords >= 2 && f.keystrokeAvgMs !== null && f.keystrokeAvgMs < 100)
    return "captcha_mfa";
  return "granted";
}

function tree13(f: RiskFeatures): RiskDecision {
  const score =
    f.failedPasswords * 2 +
    f.failedCodes * 1.5 +
    (f.isProxy ? 3 : 0) +
    (f.isHosting ? 4 : 0) +
    (f.hasSuspiciousUA ? 3 : 0);
  if (score >= 8) return "blocked";
  if (score >= 5) return "honeypot";
  if (score >= 3) return "captcha_mfa";
  return "granted";
}

function tree14(f: RiskFeatures): RiskDecision {
  if (f.requestsPerMinute > 30 && f.mouseMovements < 5) return "blocked";
  if (f.failedPasswords >= 2 && f.scrollEvents === 0) return "honeypot";
  if (f.isProxy || f.isOffHoursIST) return "captcha_mfa";
  return "granted";
}

function tree15(f: RiskFeatures): RiskDecision {
  const highRisk =
    f.failedPasswords >= 3 || f.requestsPerMinute > 25 || (f.isHosting && f.hasSuspiciousUA);
  const medRisk = f.failedPasswords >= 1 || f.isProxy || f.failedCodes >= 2;
  if (highRisk && medRisk) return "blocked";
  if (highRisk) return "honeypot";
  if (medRisk) return "captcha_mfa";
  return "granted";
}

const TREES: ((f: RiskFeatures) => RiskDecision)[] = [
  tree1,
  tree2,
  tree3,
  tree4,
  tree5,
  tree6,
  tree7,
  tree8,
  tree9,
  tree10,
  tree11,
  tree12,
  tree13,
  tree14,
  tree15,
];

export const DECISION_SCORES: Record<RiskDecision, number> = {
  granted: 0,
  captcha_mfa: 35,
  honeypot: 65,
  blocked: 90,
};

export const DECISION_SEVERITY: Record<RiskDecision, number> = {
  granted: 0,
  captcha_mfa: 1,
  honeypot: 2,
  blocked: 3,
};

export function runRandomForest(features: RiskFeatures): RiskResult {
  const votes: TreeVotes = { granted: 0, captcha_mfa: 0, honeypot: 0, blocked: 0 };

  for (const tree of TREES) {
    votes[tree(features)] += 1;
  }

  const score = Math.min(
    100,
    Math.round(
      (votes.captcha_mfa * DECISION_SCORES.captcha_mfa +
        votes.honeypot * DECISION_SCORES.honeypot +
        votes.blocked * DECISION_SCORES.blocked) /
        TREES.length,
    ),
  );

  const ordered = (Object.entries(votes) as [RiskDecision, number][]).sort((a, b) => b[1] - a[1]);
  const decision: RiskDecision = ordered[0]?.[0] ?? "granted";
  const confidence = Math.round((votes[decision] / TREES.length) * 100);

  const level: RiskResult["level"] =
    score <= 30 ? "low" : score <= 60 ? "medium" : score <= 80 ? "high" : "critical";

  const breakdown: Record<string, number> = {};
  if (features.failedPasswords > 0) breakdown["Failed passwords"] = features.failedPasswords * 12;
  if (features.failedCodes > 1) breakdown["Multiple secret codes"] = features.failedCodes * 10;
  if (features.isHosting) breakdown["Datacenter IP"] = 22;
  if (features.isProxy) breakdown["VPN/Proxy detected"] = 15;
  if (features.hasSuspiciousUA) breakdown["Automation tool"] = 20;
  if (features.mouseMovements < 5) breakdown["No mouse activity"] = 18;
  if (features.keystrokeAvgMs !== null && features.keystrokeAvgMs < 80)
    breakdown["Inhuman typing speed"] = 15;
  if (features.requestsPerMinute > 10)
    breakdown["High request rate"] = Math.min(features.requestsPerMinute, 20);
  if (features.isOffHoursIST) breakdown["Off-hours access (IST)"] = 8;
  if (features.previousBlocks > 0) breakdown["Previously blocked"] = features.previousBlocks * 12;

  const topSignals = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  return { score, level, decision, breakdown, topSignals, confidence, treeVotes: votes };
}

const SUSPICIOUS_AGENTS = [
  "python",
  "curl",
  "wget",
  "scrapy",
  "headless",
  "phantom",
  "selenium",
  "puppeteer",
  "postman",
  "httpie",
  "go-http",
  "java/",
  "libwww",
  "bot",
  "crawler",
  "spider",
];

/** Turns raw session telemetry into the feature vector the forest expects. */
export function buildFeatures(params: {
  failedPasswords: number;
  failedCodes: number;
  mouseMovements: number;
  keystrokeAvgMs: number | null;
  scrollEvents: number;
  pageViews: number;
  timeOnPageSeconds: number;
  userAgent: string;
  isProxy?: boolean;
  isHosting?: boolean;
  previousBlocks?: number;
  requestTimestamps?: number[];
}): RiskFeatures {
  const ua = params.userAgent.toLowerCase();
  const hasSuspiciousUA = SUSPICIOUS_AGENTS.some((agent) => ua.includes(agent));

  const istHour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const isOffHoursIST = istHour < 6 || istHour > 23;

  const now = Date.now();
  const requestsPerMinute = (params.requestTimestamps ?? []).filter(
    (stamp) => now - stamp < 60_000,
  ).length;

  return {
    failedPasswords: params.failedPasswords,
    failedCodes: params.failedCodes,
    requestsPerMinute,
    mouseMovements: params.mouseMovements,
    keystrokeAvgMs: params.keystrokeAvgMs,
    isProxy: params.isProxy ?? false,
    isHosting: params.isHosting ?? false,
    hasSuspiciousUA,
    isOffHoursIST,
    previousBlocks: params.previousBlocks ?? 0,
    timeOnPageSeconds: params.timeOnPageSeconds,
    scrollEvents: params.scrollEvents,
    pageViews: params.pageViews,
  };
}

export const LEVEL_BAR_CLASS: Record<RiskResult["level"], string> = {
  low: "bg-green-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export const LEVEL_TEXT_CLASS: Record<RiskResult["level"], string> = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export function levelForScore(score: number): RiskResult["level"] {
  return score <= 30 ? "low" : score <= 60 ? "medium" : score <= 80 ? "high" : "critical";
}
