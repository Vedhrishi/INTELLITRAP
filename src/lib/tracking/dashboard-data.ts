import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Visitor = Database["public"]["Tables"]["visitors"]["Row"];
export type VisitorEvent = Database["public"]["Tables"]["visitor_events"]["Row"];
export type BlockedIp = Database["public"]["Tables"]["blocked_ips"]["Row"];
export type IpIntel = Database["public"]["Tables"]["ip_intelligence"]["Row"];
export type HoneypotActivity = Database["public"]["Tables"]["honeypot_activity"]["Row"];

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export const DECISION_LABEL: Record<string, string> = {
  granted: "Granted",
  captcha_mfa: "Challenge",
  honeypot: "Trapped",
  blocked: "Blocked",
};

export const ONLINE_WINDOW_SECONDS = 60;

export function freshHeartbeatIso(): string {
  return new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000).toISOString();
}

/** Start of the current day in IST, as an ISO timestamp. */
export function startOfIstDayIso(): string {
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
  const midnightIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate(),
  );
  return new Date(midnightIst - 5.5 * 3600 * 1000).toISOString();
}

export type DashboardStats = {
  online: number;
  today: number;
  uniqueIps: number;
  highRisk: number;
  inHoneypot: number;
  blocked: number;
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const fresh = freshHeartbeatIso();
  const [online, today, ips, highRisk, honeypot, blocked] = await Promise.all([
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("is_online", true)
      .gt("last_heartbeat", fresh),
    supabase.from("visitors").select("visitor_id").gte("first_seen", startOfIstDayIso()),
    supabase.from("ip_intelligence").select("ip_address", { count: "exact", head: true }),
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .in("risk_level", ["high", "critical"]),
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("in_honeypot", true)
      .is("honeypot_exited_at", null),
    supabase.from("blocked_ips").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const distinctToday = new Set((today.data ?? []).map((row) => row.visitor_id)).size;

  return {
    online: online.count ?? 0,
    today: distinctToday,
    uniqueIps: ips.count ?? 0,
    highRisk: highRisk.count ?? 0,
    inHoneypot: honeypot.count ?? 0,
    blocked: blocked.count ?? 0,
  };
}

export async function fetchMapVisitors(): Promise<Visitor[]> {
  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("first_seen", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentEvents(limit = 30): Promise<VisitorEvent[]> {
  const { data, error } = await supabase
    .from("visitor_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchOnlineVisitors(limit = 10): Promise<Visitor[]> {
  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("is_online", true)
    .gt("last_heartbeat", freshHeartbeatIso())
    .order("last_heartbeat", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchVisitorTimeline(sessionToken: string): Promise<VisitorEvent[]> {
  const { data, error } = await supabase
    .from("visitor_events")
    .select("*")
    .eq("session_token", sessionToken)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export function isOnline(visitor: Visitor): boolean {
  return (
    visitor.is_online &&
    new Date(visitor.last_heartbeat).getTime() > Date.now() - ONLINE_WINDOW_SECONDS * 1000
  );
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const EVENT_COLOR: Record<string, string> = {
  page_view: "bg-sky-400",
  page_exit: "bg-slate-400",
  secret_code_attempt: "bg-sky-400",
  secret_code_success: "bg-emerald-400",
  secret_code_fail: "bg-amber-400",
  password_attempt: "bg-sky-400",
  password_success: "bg-emerald-400",
  password_fail: "bg-amber-400",
  captcha_shown: "bg-amber-400",
  captcha_passed: "bg-emerald-400",
  captcha_failed: "bg-amber-400",
  otp_sent: "bg-sky-400",
  otp_passed: "bg-emerald-400",
  otp_failed: "bg-amber-400",
  file_download_real: "bg-emerald-400",
  file_download_decoy: "bg-orange-400",
  honeypot_entered: "bg-orange-400",
  honeypot_action: "bg-orange-400",
  blocked: "bg-red-500",
  rate_limited: "bg-amber-400",
  suspicious_behavior: "bg-amber-400",
  copy_attempt: "bg-slate-400",
  rapid_clicking: "bg-amber-400",
  form_submit: "bg-sky-400",
};

export const EVENT_LABEL: Record<string, string> = {
  page_view: "Page view",
  page_exit: "Left page",
  form_submit: "Form submitted",
  secret_code_attempt: "Code entered",
  secret_code_success: "Code accepted",
  secret_code_fail: "Invalid code",
  password_attempt: "Password entered",
  password_success: "Password accepted",
  password_fail: "Wrong password",
  captcha_shown: "Captcha shown",
  captcha_passed: "Captcha passed",
  captcha_failed: "Captcha failed",
  otp_sent: "OTP sent",
  otp_passed: "OTP verified",
  otp_failed: "OTP failed",
  file_download_real: "Real file downloaded",
  file_download_decoy: "Decoy downloaded",
  honeypot_entered: "Entered honeypot",
  honeypot_action: "Honeypot action",
  blocked: "IP blocked",
  rate_limited: "Rate limited",
  suspicious_behavior: "Suspicious behaviour",
  copy_attempt: "Copy attempt",
  rapid_clicking: "Rapid clicking",
};
