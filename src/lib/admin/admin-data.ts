import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { startOfTodayIST } from "@/lib/share/format";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BlockedIp = Database["public"]["Tables"]["blocked_ips"]["Row"];
export type IpIntel = Database["public"]["Tables"]["ip_intelligence"]["Row"];
export type PlatformSetting = Database["public"]["Tables"]["platform_settings"]["Row"];
export type AdminAuditLog = Database["public"]["Tables"]["admin_audit_log"]["Row"];
export type Visitor = Database["public"]["Tables"]["visitors"]["Row"];
export type VisitorEvent = Database["public"]["Tables"]["visitor_events"]["Row"];
export type HoneypotActivity = Database["public"]["Tables"]["honeypot_activity"]["Row"];

export const REMOVAL_REASONS = [
  "Violated Terms of Service",
  "Suspicious or malicious activity",
  "Account security compromise",
  "Spam or system abuse",
  "Admin decision",
] as const;

export type RemovalReason = (typeof REMOVAL_REASONS)[number];

export const PLATFORM_SETTING_KEYS = {
  registrationEnabled: "registration_enabled",
  honeypotEnabled: "honeypot_enabled",
  autoBlockEnabled: "auto_block_enabled",
  maintenanceMode: "maintenance_mode",
  thresholdMedium: "risk_threshold_medium",
  thresholdHigh: "risk_threshold_high",
  thresholdCritical: "risk_threshold_critical",
} as const;

export type AdminKpis = {
  totalUsers: number;
  visitorsToday: number;
  autoBlocksToday: number;
  activeHoneypots: number;
  criticalRiskNow: number;
  platformHealth: number;
};

export async function fetchAdminKpis(): Promise<AdminKpis> {
  const todayIso = startOfTodayIST();
  const [users, visitorsToday, blocksToday, honeypots, critical] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("visitors").select("visitor_id").gte("first_seen", todayIso),
    supabase
      .from("blocked_ips")
      .select("id", { count: "exact", head: true })
      .gte("blocked_at", todayIso),
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("in_honeypot", true)
      .is("honeypot_exited_at", null),
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("risk_level", "critical"),
  ]);

  const distinctToday = new Set((visitorsToday.data ?? []).map((row) => row.visitor_id)).size;
  const blockedToday = blocksToday.count ?? 0;
  const health = 100 - Math.min((blockedToday / Math.max(distinctToday, 1)) * 100, 100);

  return {
    totalUsers: users.count ?? 0,
    visitorsToday: distinctToday,
    autoBlocksToday: blockedToday,
    activeHoneypots: honeypots.count ?? 0,
    criticalRiskNow: critical.count ?? 0,
    platformHealth: distinctToday === 0 ? 100 : Math.round(health),
  };
}

export async function fetchRecentEventsAll(limit = 40): Promise<VisitorEvent[]> {
  const { data, error } = await supabase
    .from("visitor_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type ProfilePage = { rows: Profile[]; count: number };

export async function fetchProfilesPage(page: number, pageSize = 20): Promise<ProfilePage> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function setProfileStatus(userId: string, status: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) throw error;
}

export async function insertAuditLog(entry: {
  adminId: string | null;
  adminEmail: string | null;
  actionType: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    admin_email: entry.adminEmail,
    action_type: entry.actionType,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details: entry.details as Json,
  });
  if (error) throw error;
}

export type RemoveUserOptions = {
  target: Profile;
  reason: RemovalReason;
  banIp: boolean;
  wipeFiles: boolean;
  admin: { id: string | null; email: string | null };
};

export async function removeUser(options: RemoveUserOptions): Promise<void> {
  const { target, reason, banIp, wipeFiles, admin } = options;
  if (target.role === "admin") {
    throw new Error("Admin accounts are protected");
  }

  const { error: statusError } = await supabase
    .from("profiles")
    .update({ status: "removed" })
    .eq("id", target.id);
  if (statusError) throw statusError;

  if (banIp && target.last_login_ip) {
    const { error: blockError } = await supabase.from("blocked_ips").insert({
      ip_address: target.last_login_ip,
      reason: `User removal: ${reason}`,
      block_type: "manual",
      blocked_by_admin: admin.id,
      is_active: true,
    });
    if (blockError) throw blockError;
  }

  if (wipeFiles) {
    const { error: wipeError } = await supabase
      .from("files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("owner_id", target.id)
      .is("deleted_at", null);
    if (wipeError) throw wipeError;
  }

  await insertAuditLog({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "user_removed",
    targetType: "profile",
    targetId: target.id,
    details: { reason, banIp, wipeFiles, email: target.email },
  });
}

export async function fetchActiveVisitors(): Promise<Visitor[]> {
  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .order("first_seen", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveHoneypots(): Promise<Visitor[]> {
  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("in_honeypot", true)
    .is("honeypot_exited_at", null)
    .order("honeypot_entered_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHoneypotActivity(sessionToken: string): Promise<HoneypotActivity[]> {
  const { data, error } = await supabase
    .from("honeypot_activity")
    .select("*")
    .eq("session_token", sessionToken)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function releaseHoneypot(visitorId: string): Promise<void> {
  const { error } = await supabase
    .from("visitors")
    .update({ honeypot_exited_at: new Date().toISOString(), in_honeypot: false })
    .eq("id", visitorId);
  if (error) throw error;
}

export async function escalateToBlock(
  visitor: Visitor,
  admin: { id: string | null; email: string | null },
): Promise<void> {
  const { error } = await supabase.from("blocked_ips").insert({
    ip_address: visitor.ip_address,
    reason: "Escalated from active honeypot session",
    block_type: "manual",
    blocked_by_admin: admin.id,
    session_token: visitor.session_token,
    visitor_id: visitor.id,
    trigger_score: visitor.risk_score,
    trigger_signals: visitor.risk_signals,
    is_active: true,
  });
  if (error) throw error;

  await insertAuditLog({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "honeypot_escalated",
    targetType: "visitor",
    targetId: visitor.id,
    details: { ip: visitor.ip_address, session: visitor.session_token },
  });
}

export async function fetchActiveBlocks(): Promise<BlockedIp[]> {
  const { data, error } = await supabase
    .from("blocked_ips")
    .select("*")
    .eq("is_active", true)
    .order("blocked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function liftBlock(id: string): Promise<void> {
  const { error } = await supabase
    .from("blocked_ips")
    .update({ is_active: false, unblocked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function insertManualBlock(
  ip: string,
  reason: string,
  admin: { id: string | null },
): Promise<void> {
  const { error } = await supabase.from("blocked_ips").insert({
    ip_address: ip,
    reason,
    block_type: "manual",
    blocked_by_admin: admin.id,
    is_active: true,
  });
  if (error) throw error;
}

export async function fetchTodaySignalFrequency(): Promise<{ signal: string; count: number }[]> {
  const { data, error } = await supabase
    .from("visitor_events")
    .select("event_type")
    .gte("created_at", startOfTodayIST());
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

export async function fetchAuditLog(limit = 100): Promise<AdminAuditLog[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlatformSettings(): Promise<PlatformSetting[]> {
  const { data, error } = await supabase.from("platform_settings").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function upsertPlatformSettings(
  entries: { key: string; value: string }[],
  adminId: string | null,
): Promise<void> {
  const { error } = await supabase.from("platform_settings").upsert(
    entries.map((entry) => ({ key: entry.key, value: entry.value, updated_by: adminId })),
    { onConflict: "key" },
  );
  if (error) throw error;
}

export async function fetchWhitelist(): Promise<IpIntel[]> {
  const { data, error } = await supabase
    .from("ip_intelligence")
    .select("*")
    .eq("is_whitelisted", true)
    .order("last_seen", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setWhitelist(ip: string, whitelisted: boolean): Promise<void> {
  const { error } = await supabase
    .from("ip_intelligence")
    .update({ is_whitelisted: whitelisted })
    .eq("ip_address", ip);
  if (error) throw error;
}

export async function addWhitelistIp(ip: string): Promise<void> {
  const { error } = await supabase
    .from("ip_intelligence")
    .upsert({ ip_address: ip, is_whitelisted: true }, { onConflict: "ip_address" });
  if (error) throw error;
}

export function severityColor(eventType: string): string {
  if (eventType.includes("block") || eventType === "blocked") return "#ef4444";
  if (eventType.includes("honeypot")) return "#f97316";
  if (eventType.includes("fail") || eventType.includes("suspicious") || eventType.includes("rate_limited"))
    return "#f59e0b";
  return "#3b82f6";
}
