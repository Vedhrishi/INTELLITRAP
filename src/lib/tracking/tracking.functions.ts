import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BRUTE_FORCE_LIMIT } from "@/config/security";
import {
  alertAdmins,
  clientIp,
  geoFromTimezone,
  hashSharePassword,
  intelGeo,
  isIpBlocked,
  lookupGeo,
  scoreVisitor,
} from "./tracking.server";

const deviceSchema = z
  .object({
    userAgent: z.string().max(1000).optional(),
    browser: z.string().max(120).optional(),
    browserVersion: z.string().max(60).optional(),
    os: z.string().max(120).optional(),
    osVersion: z.string().max(60).optional(),
    deviceType: z.string().max(60).optional(),
    vendor: z.string().max(120).optional(),
    screen: z.string().max(40).optional(),
    colorDepth: z.number().int().optional(),
    tzOffset: z.number().int().optional(),
    timezone: z.string().max(80).optional(),
    language: z.string().max(40).optional(),
    languages: z.array(z.string().max(40)).max(20).optional(),
    cores: z.number().int().optional(),
    memory: z.number().optional(),
    touch: z.boolean().optional(),
  })
  .partial();

const behaviorSchema = z
  .object({
    mouseMovements: z.number().int().nonnegative().max(1_000_000).optional(),
    mouseDistance: z.number().int().nonnegative().max(50_000_000).optional(),
    keystrokes: z.number().int().nonnegative().max(1_000_000).optional(),
    avgKeystrokeMs: z.number().int().nonnegative().max(100_000).nullable().optional(),
    clicks: z.number().int().nonnegative().max(1_000_000).optional(),
    scrolls: z.number().int().nonnegative().max(1_000_000).optional(),
    copies: z.number().int().nonnegative().max(100_000).optional(),
    tabSwitches: z.number().int().nonnegative().max(100_000).optional(),
    timeOnSite: z
      .number()
      .int()
      .nonnegative()
      .max(86_400 * 7)
      .optional(),
  })
  .partial();

const token = z.string().uuid();
const eventTypes = [
  "page_view",
  "page_exit",
  "form_submit",
  "secret_code_attempt",
  "secret_code_success",
  "secret_code_fail",
  "password_attempt",
  "password_success",
  "password_fail",
  "captcha_shown",
  "captcha_passed",
  "captcha_failed",
  "otp_sent",
  "otp_passed",
  "otp_failed",
  "file_download_real",
  "file_download_decoy",
  "honeypot_entered",
  "honeypot_action",
  "blocked",
  "rate_limited",
  "suspicious_behavior",
  "copy_attempt",
  "rapid_clicking",
] as const;

/** Records/refreshes a visitor session. Public by design — visitors are anonymous. */
export const trackVisitor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session_token: token,
        visitor_id: token,
        page: z.string().max(300),
        referrer: z.string().max(500).optional().default(""),
        device: deviceSchema.optional().default({}),
        behavior: behaviorSchema.optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();

    const blocked = await isIpBlocked(supabaseAdmin, ip);
    if (blocked) return { blocked: true, reason: blocked, ip, sessionToken: data.session_token };

    const { device, behavior } = data;
    let geo = await lookupGeo(ip, supabaseAdmin);
    // Last resort so the visitor still appears on the map: the browser's own timezone.
    if (geo.latitude == null) geo = geoFromTimezone(device.timezone);

    const { data: existing } = await supabaseAdmin
      .from("visitors")
      .select("id, page_views, pages_visited")
      .eq("session_token", data.session_token)
      .maybeSingle();

    const payload = {
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      ...geo,
      user_agent: device.userAgent ?? null,
      browser: device.browser ?? null,
      browser_version: device.browserVersion ?? null,
      os: device.os ?? null,
      os_version: device.osVersion ?? null,
      device_type: device.deviceType ?? null,
      device_vendor: device.vendor ?? null,
      screen_resolution: device.screen ?? null,
      color_depth: device.colorDepth ?? null,
      timezone_offset: device.tzOffset ?? null,
      language: device.language ?? null,
      languages: device.languages ?? null,
      hardware_concurrency: device.cores ?? null,
      device_memory: device.memory ? Math.round(device.memory) : null,
      touch_support: device.touch ?? null,
      current_page: data.page,
      referrer: data.referrer || null,
      mouse_movements: behavior.mouseMovements ?? 0,
      mouse_distance_px: behavior.mouseDistance ?? 0,
      keystrokes: behavior.keystrokes ?? 0,
      avg_keystroke_interval_ms: behavior.avgKeystrokeMs ?? null,
      clicks: behavior.clicks ?? 0,
      scroll_events: behavior.scrolls ?? 0,
      time_on_site_seconds: behavior.timeOnSite ?? 0,
      copy_events: behavior.copies ?? 0,
      tab_switches: behavior.tabSwitches ?? 0,
      is_online: true,
      last_heartbeat: new Date().toISOString(),
    };

    if (existing) {
      const pages = Array.from(new Set([...(existing.pages_visited ?? []), data.page]));
      await supabaseAdmin
        .from("visitors")
        .update({ ...payload, page_views: (existing.page_views ?? 0) + 1, pages_visited: pages })
        .eq("session_token", data.session_token);
    } else {
      await supabaseAdmin
        .from("visitors")
        .insert({ ...payload, entry_page: data.page, page_views: 1, pages_visited: [data.page] });
    }

    const { data: intel } = await supabaseAdmin
      .from("ip_intelligence")
      .select("total_page_views, total_sessions, browsers_used")
      .eq("ip_address", ip)
      .maybeSingle();

    // Never overwrite a cached location with nulls when a lookup came back empty.
    const geoPatch = geo.latitude != null ? intelGeo(geo) : {};

    if (intel) {
      const browsers = Array.from(
        new Set([...(intel.browsers_used ?? []), device.browser].filter(Boolean) as string[]),
      );
      await supabaseAdmin
        .from("ip_intelligence")
        .update({
          last_seen: new Date().toISOString(),
          total_page_views: (intel.total_page_views ?? 0) + 1,
          total_sessions: existing ? (intel.total_sessions ?? 1) : (intel.total_sessions ?? 0) + 1,
          browsers_used: browsers,
          ...geoPatch,
        })
        .eq("ip_address", ip);
    } else {
      await supabaseAdmin.from("ip_intelligence").insert({
        ip_address: ip,
        total_sessions: 1,
        total_page_views: 1,
        browsers_used: device.browser ? [device.browser] : [],
        ...geoPatch,
      });
    }

    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      event_type: "page_view",
      page_path: data.page,
      event_data: { referrer: data.referrer || null },
    });

    return { blocked: false, ip, geo, sessionToken: data.session_token };
  });

/** Lightweight heartbeat so the dashboard knows who is still online. */
export const visitorHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session_token: token,
        page: z.string().max(300),
        timezone: z.string().max(80).optional(),
        behavior: behaviorSchema.optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { behavior } = data;

    // A visitor whose first lookup failed gets another chance on every beat,
    // so nobody stays permanently unlocated on the map.
    const { data: row } = await supabaseAdmin
      .from("visitors")
      .select("latitude, timezone")
      .eq("session_token", data.session_token)
      .maybeSingle();
    let geo: Awaited<ReturnType<typeof lookupGeo>> = {};
    if (row && row.latitude == null) {
      geo = await lookupGeo(clientIp(), supabaseAdmin);
      if (geo.latitude == null) geo = geoFromTimezone(data.timezone ?? row.timezone);
    }

    await supabaseAdmin
      .from("visitors")
      .update({
        ...(geo.latitude != null ? geo : {}),
        is_online: true,
        last_heartbeat: new Date().toISOString(),
        current_page: data.page,
        mouse_movements: behavior.mouseMovements ?? 0,
        mouse_distance_px: behavior.mouseDistance ?? 0,
        keystrokes: behavior.keystrokes ?? 0,
        avg_keystroke_interval_ms: behavior.avgKeystrokeMs ?? null,
        clicks: behavior.clicks ?? 0,
        scroll_events: behavior.scrolls ?? 0,
        copy_events: behavior.copies ?? 0,
        tab_switches: behavior.tabSwitches ?? 0,
        time_on_site_seconds: behavior.timeOnSite ?? 0,
      })
      .eq("session_token", data.session_token);
    return { ok: true };
  });

/** Marks a session offline when the tab is closed or hidden. */
export const markVisitorOffline = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session_token: token }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("visitors")
      .update({ is_online: false, session_ended_at: new Date().toISOString() })
      .eq("session_token", data.session_token);
    return { ok: true };
  });

export const logVisitorEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session_token: token,
        visitor_id: token,
        event_type: z.enum(eventTypes),
        page_path: z.string().max(300).optional(),
        event_data: z.record(z.unknown()).optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: clientIp(),
      event_type: data.event_type,
      page_path: data.page_path ?? null,
      event_data: data.event_data as never,
    });
    return { ok: true };
  });

/** Scores the session, then grants, challenges, traps or blocks it. */
export const assessVisitorRisk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session_token: token }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();

    const { data: visitor } = await supabaseAdmin
      .from("visitors")
      .select("*")
      .eq("session_token", data.session_token)
      .maybeSingle();
    if (!visitor) return { error: "Session not found" as const };

    const { data: intel } = await supabaseAdmin
      .from("ip_intelligence")
      .select("*")
      .eq("ip_address", visitor.ip_address)
      .maybeSingle();

    const [{ count: passwordFails }, { count: codeFails }, { count: recentEvents }] =
      await Promise.all([
        supabaseAdmin
          .from("visitor_events")
          .select("*", { count: "exact", head: true })
          .eq("session_token", data.session_token)
          .eq("event_type", "password_fail"),
        supabaseAdmin
          .from("visitor_events")
          .select("*", { count: "exact", head: true })
          .eq("session_token", data.session_token)
          .eq("event_type", "secret_code_fail"),
        supabaseAdmin
          .from("visitor_events")
          .select("*", { count: "exact", head: true })
          .eq("session_token", data.session_token)
          .gte("created_at", new Date(Date.now() - 60_000).toISOString()),
      ]);

    const outcome = scoreVisitor({
      visitor,
      intel,
      passwordFails: passwordFails ?? 0,
      codeFails: codeFails ?? 0,
      recentEvents: recentEvents ?? 0,
    });

    await supabaseAdmin
      .from("visitors")
      .update({
        risk_score: outcome.score,
        risk_level: outcome.level,
        risk_breakdown: outcome.breakdown as never,
        risk_signals: outcome.signals,
        access_decision: outcome.decision,
      })
      .eq("session_token", data.session_token);

    await supabaseAdmin
      .from("ip_intelligence")
      .update({
        current_risk_score: outcome.score,
        highest_risk_score: Math.max(intel?.highest_risk_score ?? 0, outcome.score),
        threat_classification:
          outcome.score > 80
            ? "attacker"
            : outcome.score > 60
              ? "bot"
              : outcome.score > 30
                ? "suspicious"
                : "benign",
      })
      .eq("ip_address", visitor.ip_address);

    if (outcome.decision === "blocked") {
      await supabaseAdmin.from("blocked_ips").upsert(
        {
          ip_address: visitor.ip_address,
          session_token: data.session_token,
          visitor_id: visitor.visitor_id,
          block_type: "auto",
          trigger_score: outcome.score,
          trigger_signals: outcome.signals,
          reason: `AI auto-block: score ${outcome.score}/100`,
          geo_snapshot: {
            city: visitor.city,
            region: visitor.region,
            country: visitor.country,
            isp: visitor.isp,
          } as never,
          device_snapshot: {
            browser: visitor.browser,
            os: visitor.os,
            device: visitor.device_type,
          } as never,
          is_active: true,
        },
        { onConflict: "ip_address" },
      );
      await supabaseAdmin
        .from("visitors")
        .update({
          was_blocked: true,
          blocked_at: new Date().toISOString(),
          block_reason: `Risk score ${outcome.score}/100`,
        })
        .eq("session_token", data.session_token);
      if (intel)
        await supabaseAdmin
          .from("ip_intelligence")
          .update({ times_blocked: (intel.times_blocked ?? 0) + 1 })
          .eq("ip_address", visitor.ip_address);
      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: visitor.visitor_id,
        ip_address: ip,
        event_type: "blocked",
        event_data: {
          score: outcome.score,
          signals: outcome.signals,
          breakdown: outcome.breakdown,
        } as never,
      });
      await alertAdmins(supabaseAdmin, {
        ip: visitor.ip_address,
        score: outcome.score,
        signals: outcome.signals,
        city: visitor.city,
        country: visitor.country,
      });
    }

    if (outcome.decision === "honeypot") {
      await supabaseAdmin
        .from("visitors")
        .update({ in_honeypot: true, honeypot_entered_at: new Date().toISOString() })
        .eq("session_token", data.session_token);
      if (intel)
        await supabaseAdmin
          .from("ip_intelligence")
          .update({ times_honeypotted: (intel.times_honeypotted ?? 0) + 1 })
          .eq("ip_address", visitor.ip_address);
      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: visitor.visitor_id,
        ip_address: ip,
        event_type: "honeypot_entered",
        event_data: { score: outcome.score } as never,
      });
    }

    return {
      score: outcome.score,
      level: outcome.level,
      decision: outcome.decision,
      breakdown: outcome.breakdown,
      signals: outcome.signals,
    };
  });

/** Resolves a share code to its owner's first name. Never leaks emails or ids. */
export const findShareOwner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        secret_code: z.string().min(4).max(24),
        session_token: token,
        visitor_id: token,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const code = data.secret_code.trim().toUpperCase();

    if (await isIpBlocked(supabaseAdmin, ip)) return { found: false, blocked: true as const };

    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      event_type: "secret_code_attempt",
      event_data: { code } as never,
    });

    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_secret_code", code)
      .maybeSingle();

    if (!owner) {
      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: data.visitor_id,
        ip_address: ip,
        event_type: "secret_code_fail",
        event_data: { code } as never,
      });
      const { data: intel } = await supabaseAdmin
        .from("ip_intelligence")
        .select("total_failed_codes")
        .eq("ip_address", ip)
        .maybeSingle();
      if (intel)
        await supabaseAdmin
          .from("ip_intelligence")
          .update({ total_failed_codes: (intel.total_failed_codes ?? 0) + 1 })
          .eq("ip_address", ip);
      return { found: false, blocked: false as const };
    }

    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      event_type: "secret_code_success",
      event_data: { code } as never,
    });

    const name = (owner.display_name ?? owner.full_name ?? "the owner").split(" ")[0];
    return { found: true as const, blocked: false as const, ownerName: name };
  });

/** Verifies a shared-file password and returns a short-lived signed download URL. */
export const verifyFilePassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        secret_code: z.string().min(4).max(24),
        password: z.string().min(1).max(200),
        session_token: token,
        visitor_id: token,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    if (await isIpBlocked(supabaseAdmin, ip))
      return { success: false as const, blocked: true, error: "Access denied" };

    const code = data.secret_code.trim().toUpperCase();
    const { data: file } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("uploader_secret_code", code)
      .eq("is_shared", true)
      .eq("share_revoked", false)
      .eq("consumed", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!file) return { success: false as const, error: "No shared file found for this code." };

    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      await supabaseAdmin.from("file_access_log").insert({
        file_id: file.id,
        session_token: data.session_token,
        ip_address: ip,
        outcome: "expired",
      });
      return { success: false as const, error: "This link has expired." };
    }
    if (file.one_time && file.download_count > 0) {
      await supabaseAdmin.from("file_access_log").insert({
        file_id: file.id,
        session_token: data.session_token,
        ip_address: ip,
        outcome: "consumed",
      });
      return { success: false as const, error: "This file has already been downloaded." };
    }

    const inputHash = await hashSharePassword(data.password);
    if (!file.file_password_hash || inputHash !== file.file_password_hash) {
      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: data.visitor_id,
        ip_address: ip,
        event_type: "password_fail",
        event_data: { code } as never,
      });
      await supabaseAdmin.from("file_access_log").insert({
        file_id: file.id,
        session_token: data.session_token,
        ip_address: ip,
        outcome: "wrong_password",
      });
      const { data: intel } = await supabaseAdmin
        .from("ip_intelligence")
        .select("total_failed_passwords")
        .eq("ip_address", ip)
        .maybeSingle();
      if (intel)
        await supabaseAdmin
          .from("ip_intelligence")
          .update({ total_failed_passwords: (intel.total_failed_passwords ?? 0) + 1 })
          .eq("ip_address", ip);

      // Brute force on a share password is deception-worthy on its own: after
      // BRUTE_FORCE_LIMIT wrong passwords in one session the visitor is moved
      // into the honeypot and served decoys from here on.
      const { data: failRows } = await supabaseAdmin
        .from("visitor_events")
        .select("id")
        .eq("session_token", data.session_token)
        .eq("event_type", "password_fail")
        .limit(50);
      const sessionFails = failRows?.length ?? 0;
      if (sessionFails >= BRUTE_FORCE_LIMIT) {
        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("visitors")
          .update({
            in_honeypot: true,
            honeypot_entered_at: nowIso,
            access_decision: "honeypot",
          })
          .eq("session_token", data.session_token);
        await supabaseAdmin.from("honeypot_activity").insert({
          session_token: data.session_token,
          ip_address: ip,
          action: "honeypot_entered",
          event_data: {
            trigger: "password_brute_force",
            failed_passwords: sessionFails,
          } as never,
        });
        await supabaseAdmin.from("visitor_events").insert({
          session_token: data.session_token,
          visitor_id: data.visitor_id,
          ip_address: ip,
          event_type: "honeypot_entered",
          page_path: "/share",
          event_data: { trigger: "password_brute_force" } as never,
        });
        return { success: false as const, honeypot: true as const, error: "Access denied." };
      }
      return { success: false as const, error: "Incorrect password." };
    }


    // Correct password is not enough: a session the risk engine already sent to
    // the honeypot (or blocked) never receives a signed URL for the real file.
    const { data: verdict } = await supabaseAdmin
      .from("visitors")
      .select("access_decision, in_honeypot, was_blocked")
      .eq("session_token", data.session_token)
      .maybeSingle();
    if (verdict?.was_blocked || verdict?.access_decision === "blocked") {
      return { success: false as const, blocked: true as const, error: "Access denied." };
    }
    if (verdict?.in_honeypot || verdict?.access_decision === "honeypot") {
      await supabaseAdmin.from("file_access_log").insert({
        file_id: file.id,
        session_token: data.session_token,
        ip_address: ip,
        outcome: "honeypot",
      });
      return { success: false as const, honeypot: true as const, error: "Access denied." };
    }

    const { data: signed } = await supabaseAdmin.storage
      .from("user-files")
      .createSignedUrl(file.storage_path, 60);

    await supabaseAdmin
      .from("files")
      .update({ download_count: file.download_count + 1 })
      .eq("id", file.id);
    await supabaseAdmin.from("file_access_log").insert({
      file_id: file.id,
      session_token: data.session_token,
      ip_address: ip,
      outcome: "success",
    });
    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      event_type: "password_success",
      event_data: { file_id: file.id } as never,
    });

    if (file.one_time) {
      await supabaseAdmin.storage.from("user-files").remove([file.storage_path]);
      await supabaseAdmin
        .from("files")
        .update({ consumed: true, share_revoked: true })
        .eq("id", file.id);
    }

    return {
      success: true as const,
      url: signed?.signedUrl ?? null,
      fileName: file.name,
      fileSize: file.size_bytes,
      fileType: file.mime_type,
      oneTime: file.one_time,
    };
  });

/** Serves decoy documents to a trapped session. */
export const getDecoyFiles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session_token: token }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: visitor } = await supabaseAdmin
      .from("visitors")
      .select("in_honeypot")
      .eq("session_token", data.session_token)
      .maybeSingle();
    if (!visitor?.in_honeypot) return { files: [] };

    const { data: templates } = await supabaseAdmin
      .from("decoy_file_templates")
      .select("id, file_name, content, mime_type, category, lure_score")
      .order("lure_score", { ascending: false })
      .limit(4);
    return { files: templates ?? [] };
  });

/** Records every action an attacker takes inside the trap. */
export const logHoneypotAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session_token: token,
        visitor_id: token,
        action: z.string().max(120),
        decoy_file_name: z.string().max(200).optional(),
        decoy_id: z.string().uuid().optional(),
        time_spent_seconds: z.number().int().nonnegative().max(86_400).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();

    await supabaseAdmin.from("honeypot_activity").insert({
      session_token: data.session_token,
      ip_address: ip,
      action: data.action,
      decoy_file_name: data.decoy_file_name ?? null,
      time_spent_seconds: data.time_spent_seconds,
    });

    if (data.decoy_file_name) {
      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: data.visitor_id,
        ip_address: ip,
        event_type: "file_download_decoy",
        event_data: { file: data.decoy_file_name } as never,
      });
      const { data: visitor } = await supabaseAdmin
        .from("visitors")
        .select("decoy_files_downloaded")
        .eq("session_token", data.session_token)
        .maybeSingle();
      const files = Array.from(
        new Set([...(visitor?.decoy_files_downloaded ?? []), data.decoy_file_name]),
      );
      await supabaseAdmin
        .from("visitors")
        .update({ decoy_files_downloaded: files })
        .eq("session_token", data.session_token);
      if (data.decoy_id) {
        const { data: template } = await supabaseAdmin
          .from("decoy_file_templates")
          .select("times_served")
          .eq("id", data.decoy_id)
          .maybeSingle();
        await supabaseAdmin
          .from("decoy_file_templates")
          .update({ times_served: (template?.times_served ?? 0) + 1 })
          .eq("id", data.decoy_id);
      }
    }
    return { ok: true };
  });

const treeVotesSchema = z.object({
  granted: z.number().int().nonnegative().max(15),
  captcha_mfa: z.number().int().nonnegative().max(15),
  honeypot: z.number().int().nonnegative().max(15),
  blocked: z.number().int().nonnegative().max(15),
});

/**
 * Applies a client-side Random Forest verdict server-side: auto-blocks the IP,
 * records the honeypot entry and writes the telemetry event. Security tables
 * reject anonymous writes, so this must run through the admin client.
 */
export const applyRiskVerdict = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session_token: token,
        visitor_id: token,
        decision: z.enum(["granted", "captcha_mfa", "honeypot", "blocked"]),
        score: z.number().int().min(0).max(100),
        confidence: z.number().int().min(0).max(100),
        tree_votes: treeVotesSchema,
        top_signals: z.array(z.string().max(80)).max(10).default([]),
        breakdown: z.record(z.string().max(80), z.number()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const nowIso = new Date().toISOString();

    const { data: visitor } = await supabaseAdmin
      .from("visitors")
      .select("city, region, country, isp, latitude, longitude, visitor_id")
      .eq("session_token", data.session_token)
      .maybeSingle();

    const geoSnapshot = {
      city: visitor?.city ?? null,
      region: visitor?.region ?? null,
      country: visitor?.country ?? null,
      isp: visitor?.isp ?? null,
      latitude: visitor?.latitude ?? null,
      longitude: visitor?.longitude ?? null,
    };

    if (data.decision === "blocked") {
      await supabaseAdmin.from("blocked_ips").upsert(
        {
          ip_address: ip,
          session_token: data.session_token,
          visitor_id: data.visitor_id,
          reason: `AI auto-block: RF score ${data.score}/100`,
          trigger_score: data.score,
          trigger_signals: data.top_signals,
          block_type: "auto",
          geo_snapshot: geoSnapshot as never,
          device_snapshot: {
            rf_confidence: data.confidence,
            tree_votes: data.tree_votes,
          } as never,
          is_active: true,
          blocked_at: nowIso,
          unblocked_at: null,
        },
        { onConflict: "ip_address" },
      );

      await supabaseAdmin
        .from("visitors")
        .update({
          was_blocked: true,
          blocked_at: nowIso,
          block_reason: `AI auto-block: RF score ${data.score}/100`,
          access_decision: "blocked",
        })
        .eq("session_token", data.session_token);

      await supabaseAdmin.from("visitor_events").insert({
        session_token: data.session_token,
        visitor_id: data.visitor_id,
        ip_address: ip,
        event_type: "blocked",
        page_path: "/share",
        event_data: {
          rf_score: data.score,
          rf_decision: data.decision,
          tree_votes: data.tree_votes,
          top_signals: data.top_signals,
          confidence: data.confidence,
          breakdown: data.breakdown,
        } as never,
      });

      return { ok: true as const, blocked: true as const };
    }

    if (data.decision === "honeypot") {
      await supabaseAdmin.from("honeypot_activity").insert({
        session_token: data.session_token,
        ip_address: ip,
        action: "honeypot_entered",
        event_data: {
          rf_score: data.score,
          tree_votes: data.tree_votes,
          trigger_signals: data.top_signals,
          confidence: data.confidence,
        } as never,
      });

      await supabaseAdmin
        .from("visitors")
        .update({
          in_honeypot: true,
          honeypot_entered_at: nowIso,
          access_decision: "honeypot",
        })
        .eq("session_token", data.session_token);
    }

    await supabaseAdmin.from("visitor_events").insert({
      session_token: data.session_token,
      visitor_id: data.visitor_id,
      ip_address: ip,
      event_type: data.decision === "honeypot" ? "honeypot_entered" : "suspicious_behavior",
      page_path: "/share",
      event_data: {
        rf_score: data.score,
        rf_decision: data.decision,
        tree_votes: data.tree_votes,
        top_signals: data.top_signals,
        confidence: data.confidence,
        breakdown: data.breakdown,
      } as never,
    });

    return { ok: true as const, blocked: false as const };
  });

/** Whether the caller's IP already carries an active block. */
export const checkSelfBlocked = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reason = await isIpBlocked(supabaseAdmin, clientIp());
  return { blocked: reason !== null, reason };
});
