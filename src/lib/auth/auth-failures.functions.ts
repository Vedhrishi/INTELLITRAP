import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Records an authentication failure for admin threat triage.
 *
 * Public on purpose — it runs before a session exists. Nothing sensitive is
 * accepted: no password, no token, and the email is masked on the client AND
 * re-masked here, so a crafted call can't smuggle a full address in.
 */
const reasons = [
  "invalid_credentials",
  "already_registered",
  "email_not_confirmed",
  "invalid_email",
  "weak_password",
  "signup_disabled",
  "rate_limited",
  "expired_link",
  "network",
  "other",
] as const;

const inputSchema = z.object({
  reason: z.enum(reasons),
  flow: z.enum(["login", "register", "reset", "update_password"]),
  maskedEmail: z.string().max(160).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
});

/** Defence-in-depth: strip anything that still looks like a full local part. */
function reMask(masked: string | null | undefined): string | null {
  const value = (masked ?? "").trim().toLowerCase().slice(0, 160);
  if (!value) return null;
  if (!value.includes("@")) return "••••";
  const [local = "", domain = ""] = value.split("@");
  if (local.includes("•")) return `${local}@${domain}`;
  if (local.length <= 2) return `${local.slice(0, 1)}••@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 6))}${local.at(-1)}@${domain}`;
}

const PER_IP_WINDOW_MS = 60_000;
const PER_IP_LIMIT = 20;

export const logAuthFailure = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clientIp, lookupGeo, geoFromTimezone } = await import("@/lib/tracking/tracking.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    const ip = clientIp();
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 500) || null;

    // Flood guard so the public endpoint can't be used to bloat the table.
    const since = new Date(Date.now() - PER_IP_WINDOW_MS).toISOString();
    const { count } = await supabaseAdmin
      .from("auth_failure_log")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= PER_IP_LIMIT) return { logged: false as const };

    let geo = await lookupGeo(ip, supabaseAdmin);
    if (!geo.country) geo = { ...geo, ...geoFromTimezone(data.timezone ?? null) };

    const { error } = await supabaseAdmin.from("auth_failure_log").insert({
      reason: data.reason,
      flow: data.flow,
      masked_email: reMask(data.maskedEmail),
      ip_address: ip,
      country: geo.country ?? null,
      city: geo.city ?? null,
      user_agent: userAgent,
    });
    if (error) return { logged: false as const };
    return { logged: true as const };
  });
