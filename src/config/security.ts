import type { RuleAction } from "@/types/db";

/**
 * Single source of truth for risk-score thresholds.
 * Nothing anywhere else may hardcode these numbers.
 */
export const RISK_THRESHOLDS = {
  allowMax: 29,
  challengeMin: 30,
  challengeMax: 59,
  trapMin: 60,
  trapMax: 84,
  blockMin: 85,
} as const;

export type RiskDecision = "allow" | "challenge" | "trap" | "block";

export function decideRisk(score: number): RiskDecision {
  if (score >= RISK_THRESHOLDS.blockMin) return "block";
  if (score >= RISK_THRESHOLDS.trapMin) return "trap";
  if (score >= RISK_THRESHOLDS.challengeMin) return "challenge";
  return "allow";
}

/** Rule actions map 1:1 onto decisions except "log", which never escalates. */
export const RULE_ACTION_DECISION: Record<RuleAction, RiskDecision> = {
  log: "allow",
  challenge: "challenge",
  trap: "trap",
  block: "block",
};

export const RISK_BANDS: { decision: RiskDecision; label: string; min: number; max: number | null }[] = [
  { decision: "allow", label: "Allow", min: 0, max: RISK_THRESHOLDS.allowMax },
  { decision: "challenge", label: "Challenge", min: RISK_THRESHOLDS.challengeMin, max: RISK_THRESHOLDS.challengeMax },
  { decision: "trap", label: "Trap", min: RISK_THRESHOLDS.trapMin, max: RISK_THRESHOLDS.trapMax },
  { decision: "block", label: "Block", min: RISK_THRESHOLDS.blockMin, max: null },
];

/** Default storage quota mirrored from the database default (5 GB). */
export const DEFAULT_STORAGE_QUOTA_BYTES = 5_368_709_120;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}
