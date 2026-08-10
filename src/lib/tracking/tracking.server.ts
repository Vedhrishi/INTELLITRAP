/**
 * Server-only helpers for visitor tracking, geo enrichment and risk scoring.
 * Imported by tracking.functions.ts — never by client code.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;

export type GeoInfo = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
  isp?: string | null;
  org?: string | null;
  asn?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  is_proxy?: boolean;
  is_hosting?: boolean;
  is_mobile_network?: boolean;
};

/** Best-effort client IP from the edge headers. */
export function clientIp(): string {
  const forwarded = getRequestHeader("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ||
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    "";
  return candidate || "0.0.0.0";
}

const PRIVATE_IP = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i;

/** ipwho.is — HTTPS, no key. Returns {} on any failure. */
async function fetchGeo(ip: string): Promise<GeoInfo> {
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!response.ok) return {};
    const g = (await response.json()) as Record<string, unknown>;
    if (g["success"] !== true) return {};
    const connection = (g["connection"] ?? {}) as Record<string, unknown>;
    const timezone = (g["timezone"] ?? {}) as Record<string, unknown>;
    return {
      city: (g["city"] as string) ?? null,
      region: (g["region"] as string) ?? null,
      country: (g["country"] as string) ?? null,
      country_code: (g["country_code"] as string) ?? null,
      isp: (connection["isp"] as string) ?? null,
      org: (connection["org"] as string) ?? null,
      asn: connection["asn"] ? `AS${String(connection["asn"])}` : null,
      latitude: (g["latitude"] as number) ?? null,
      longitude: (g["longitude"] as number) ?? null,
      timezone: (timezone["id"] as string) ?? null,
      is_proxy: false,
      is_hosting: false,
      is_mobile_network: false,
    };
  } catch {
    return {};
  }
}

/**
 * Geo/ASN enrichment. Never throws — tracking must not fail on lookup errors.
 * Results are cached per IP in ip_intelligence so a provider rate limit can
 * never empty the live map for an IP we have already resolved.
 */
export async function lookupGeo(ip: string, admin?: Admin): Promise<GeoInfo> {
  if (!ip || PRIVATE_IP.test(ip)) return {};

  if (admin) {
    const { data: cached } = await admin
      .from("ip_intelligence")
      .select("city, region, country, isp, latitude, longitude, is_proxy, is_hosting")
      .eq("ip_address", ip)
      .maybeSingle();
    if (cached?.latitude != null && cached.longitude != null) {
      return {
        city: cached.city,
        region: cached.region,
        country: cached.country,
        isp: cached.isp,
        latitude: Number(cached.latitude),
        longitude: Number(cached.longitude),
        is_proxy: cached.is_proxy,
        is_hosting: cached.is_hosting,
      };
    }
  }

  return fetchGeo(ip);
}

export async function isIpBlocked(admin: Admin, ip: string): Promise<string | null> {
  const { data } = await admin
    .from("blocked_ips")
    .select("reason")
    .eq("ip_address", ip)
    .eq("is_active", true)
    .maybeSingle();
  return data ? "Access denied" : null;
}

export type RiskOutcome = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  decision: "granted" | "captcha_mfa" | "honeypot" | "blocked";
  breakdown: Record<string, number>;
  signals: string[];
};

const AUTOMATION_TOOLS = [
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
];

type VisitorRow = Database["public"]["Tables"]["visitors"]["Row"];
type IntelRow = Database["public"]["Tables"]["ip_intelligence"]["Row"];

/** Weighted behavioural + network risk model. Pure function — easy to reason about. */
export function scoreVisitor(input: {
  visitor: VisitorRow;
  intel: IntelRow | null;
  passwordFails: number;
  codeFails: number;
  recentEvents: number;
}): RiskOutcome {
  const { visitor: v, intel } = input;
  const breakdown: Record<string, number> = {};
  const signals: string[] = [];
  let score = 0;

  const add = (label: string, points: number, signal?: string) => {
    if (points <= 0) return;
    breakdown[label] = points;
    if (signal && !signals.includes(signal)) signals.push(signal);
    score += points;
  };

  if (input.passwordFails > 0)
    add("Failed Password Attempts", Math.min(input.passwordFails * 12, 35), "wrong_password");
  if (input.codeFails > 1)
    add("Multiple Invalid Codes", Math.min((input.codeFails - 1) * 15, 30), "code_enumeration");

  if (input.recentEvents > 30) add("Excessive Request Rate", 20, "rapid_requests");
  else if (input.recentEvents > 15) add("Elevated Request Rate", 10, "high_velocity");

  if (v.mouse_movements < 10 && v.keystrokes > 5) add("No Mouse Activity", 18, "bot_pattern");
  if (v.avg_keystroke_interval_ms !== null && v.avg_keystroke_interval_ms < 40)
    add("Inhuman Typing Speed", 15, "bot_typing");
  if (v.scroll_events === 0 && v.page_views > 2) add("No Scroll Behavior", 8, "bot_pattern");

  if (v.is_hosting) add("Datacenter IP", 22, "datacenter_ip");
  else if (v.is_proxy) add("Proxy or VPN", 15, "proxy_detected");

  const ua = (v.user_agent ?? "").toLowerCase();
  if (AUTOMATION_TOOLS.some((tool) => ua.includes(tool)))
    add("Automation Tool Detected", 25, "suspicious_agent");
  if (!v.user_agent || v.user_agent.length < 20) add("Missing User Agent", 15, "suspicious_agent");

  if (intel) {
    if (intel.times_blocked > 0)
      add("Previously Blocked", Math.min(intel.times_blocked * 12, 25), "repeat_offender");
    if (intel.times_honeypotted > 0)
      add("Previously Honeypotted", Math.min(intel.times_honeypotted * 8, 16));
    if (intel.is_blacklisted) add("Blacklisted IP", 40, "blacklisted");
  }

  const istHour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  if (istHour < 6 || istHour > 23) add("Off-Hours Access (IST)", 8, "off_hours");

  if (intel?.is_whitelisted) {
    return {
      score: 0,
      level: "low",
      decision: "granted",
      breakdown: { "Whitelisted IP": 0 },
      signals: [],
    };
  }

  score = Math.min(Math.round(score), 100);
  if (score <= 30) return { score, level: "low", decision: "granted", breakdown, signals };
  if (score <= 60) return { score, level: "medium", decision: "captcha_mfa", breakdown, signals };
  if (score <= 80) return { score, level: "high", decision: "honeypot", breakdown, signals };
  return { score, level: "critical", decision: "blocked", breakdown, signals };
}

/** SHA-256 hash used for shared-file passwords. Plaintext is never stored. */
export async function hashSharePassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${password}intellitrap-salt-2024`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Notifies every admin in-app when an IP is auto-blocked. */
export async function alertAdmins(
  admin: Admin,
  payload: {
    ip: string;
    score: number;
    signals: string[];
    city?: string | null;
    country?: string | null;
  },
): Promise<void> {
  const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  if (!admins?.length) return;
  const location = [payload.city, payload.country].filter(Boolean).join(", ") || "Unknown location";
  await admin.from("notifications").insert(
    admins.map((row) => ({
      user_id: row.user_id,
      title: `Auto-block: ${payload.ip} (${payload.score}/100)`,
      body: `${location} — signals: ${payload.signals.join(", ") || "none"}`,
      severity: "critical",
      link: "/admin/threat-intel",
    })),
  );
  await admin
    .from("blocked_ips")
    .update({ admin_alerted: true, alert_sent_at: new Date().toISOString() })
    .eq("ip_address", payload.ip);
}

/** ip_intelligence stores a narrower geo shape than visitors does. */
export function intelGeo(geo: GeoInfo) {
  return {
    city: geo.city ?? null,
    region: geo.region ?? null,
    country: geo.country ?? null,
    isp: geo.isp ?? null,
    latitude: geo.latitude ?? null,
    longitude: geo.longitude ?? null,
    is_proxy: geo.is_proxy ?? false,
    is_hosting: geo.is_hosting ?? false,
  };
}
