import { supabase } from "@/integrations/supabase/client";
import { freshHeartbeatIso } from "@/lib/tracking/dashboard-data";

export type NavBadgeKey = "online" | "threats" | "honeypot" | "blocked";

export type NavCounts = Record<NavBadgeKey, number>;

/** Live counters shown as sidebar badges. Non-staff users simply see zeros. */
export async function fetchNavCounts(): Promise<NavCounts> {
  const fresh = freshHeartbeatIso();
  const [online, threats, honeypot, blocked] = await Promise.all([
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("is_online", true)
      .gt("last_heartbeat", fresh),
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

  return {
    online: online.count ?? 0,
    threats: threats.count ?? 0,
    honeypot: honeypot.count ?? 0,
    blocked: blocked.count ?? 0,
  };
}
