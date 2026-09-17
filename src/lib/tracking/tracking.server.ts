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

const LOOKUP_TIMEOUT_MS = 4_000;

const num = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[geo] ${url} -> HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn(`[geo] ${url} failed:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ipwho.is — HTTPS, no key. */
async function fromIpWhoIs(ip: string): Promise<GeoInfo | null> {
  const g = await getJson(`https://ipwho.is/${ip}`);
  if (!g || g["success"] !== true) return null;
  const connection = (g["connection"] ?? {}) as Record<string, unknown>;
  const timezone = (g["timezone"] ?? {}) as Record<string, unknown>;
  const lat = num(g["latitude"]);
  const lon = num(g["longitude"]);
  if (lat === null || lon === null) return null;
  return {
    city: (g["city"] as string) ?? null,
    region: (g["region"] as string) ?? null,
    country: (g["country"] as string) ?? null,
    country_code: (g["country_code"] as string) ?? null,
    isp: (connection["isp"] as string) ?? null,
    org: (connection["org"] as string) ?? null,
    asn: connection["asn"] ? `AS${String(connection["asn"])}` : null,
    latitude: lat,
    longitude: lon,
    timezone: (timezone["id"] as string) ?? null,
    is_proxy: false,
    is_hosting: false,
    is_mobile_network: false,
  };
}

/** ipapi.co — HTTPS, no key, generous free tier. */
async function fromIpApiCo(ip: string): Promise<GeoInfo | null> {
  const g = await getJson(`https://ipapi.co/${ip}/json/`);
  if (!g || g["error"]) return null;
  const lat = num(g["latitude"]);
  const lon = num(g["longitude"]);
  if (lat === null || lon === null) return null;
  return {
    city: (g["city"] as string) ?? null,
    region: (g["region"] as string) ?? null,
    country: (g["country_name"] as string) ?? null,
    country_code: (g["country_code"] as string) ?? null,
    isp: (g["org"] as string) ?? null,
    org: (g["org"] as string) ?? null,
    asn: (g["asn"] as string) ?? null,
    latitude: lat,
    longitude: lon,
    timezone: (g["timezone"] as string) ?? null,
    is_proxy: false,
    is_hosting: false,
    is_mobile_network: false,
  };
}

/** ip-api.com over HTTPS (pro-style host also serves free https for json). */
async function fromIpApiCom(ip: string): Promise<GeoInfo | null> {
  const g = await getJson(
    `https://get.geojs.io/v1/ip/geo/${ip}.json`,
  );
  if (!g) return null;
  const lat = num(g["latitude"]);
  const lon = num(g["longitude"]);
  if (lat === null || lon === null) return null;
  return {
    city: (g["city"] as string) ?? null,
    region: (g["region"] as string) ?? null,
    country: (g["country"] as string) ?? null,
    country_code: (g["country_code"] as string) ?? null,
    isp: (g["organization_name"] as string) ?? null,
    org: (g["organization"] as string) ?? null,
    asn: g["asn"] ? `AS${String(g["asn"])}` : null,
    latitude: lat,
    longitude: lon,
    timezone: (g["timezone"] as string) ?? null,
    is_proxy: false,
    is_hosting: false,
    is_mobile_network: false,
  };
}

/** Tries every provider in order; the first one with coordinates wins. */
async function fetchGeo(ip: string): Promise<GeoInfo> {
  for (const provider of [fromIpWhoIs, fromIpApiCo, fromIpApiCom]) {
    const result = await provider(ip);
    if (result) return result;
  }
  console.warn(`[geo] all providers failed for ${ip}`);
  return {};
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

/**
 * Country/region guessed from the browser's own timezone. Used only when every
 * IP provider fails, so a visitor still lands on the map instead of vanishing.
 */
const TZ_FALLBACK: Record<string, { city: string; country: string; lat: number; lon: number }> = {
  "Asia/Kolkata": { city: "Mumbai", country: "India", lat: 19.076, lon: 72.8777 },
  "Asia/Calcutta": { city: "Mumbai", country: "India", lat: 19.076, lon: 72.8777 },
  "Asia/Dubai": { city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
  "Asia/Singapore": { city: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  "Asia/Tokyo": { city: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  "Europe/London": { city: "London", country: "United Kingdom", lat: 51.5072, lon: -0.1276 },
  "Europe/Berlin": { city: "Berlin", country: "Germany", lat: 52.52, lon: 13.405 },
  "Europe/Paris": { city: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  "America/New_York": { city: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  "America/Chicago": { city: "Chicago", country: "United States", lat: 41.8781, lon: -87.6298 },
  "America/Los_Angeles": {
    city: "Los Angeles",
    country: "United States",
    lat: 34.0522,
    lon: -118.2437,
  },
  "Australia/Sydney": { city: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
};

export function geoFromTimezone(timezone?: string | null): GeoInfo {
  if (!timezone) return {};
  const hit = TZ_FALLBACK[timezone];
  if (!hit) return {};
  return {
    city: hit.city,
    country: hit.country,
    latitude: hit.lat,
    longitude: hit.lon,
    timezone,
  };
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

/** SHA-256 hash used for share-flow OTP codes. Plaintext is never stored. */
export async function hashOtpCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${code}intellitrap-otp-salt-2024`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically random 6-digit numeric code. */
export function generateOtpCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0]! % 900000));
}

/** Sends the share-flow OTP by email via Resend's HTTP API. */
export async function sendOtpEmail(to: string, code: string): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[otp] RESEND_API_KEY is not set — cannot send verification email.");
    return { ok: false };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IntelliTrap <onboarding@resend.dev>",
        to: [to],
        subject: `${code} is your IntelliTrap verification code`,
        text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      }),
    });
    return { ok: response.ok };
  } catch (err) {
    console.error("[otp] Resend send failed", err);
    return { ok: false };
  }
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
