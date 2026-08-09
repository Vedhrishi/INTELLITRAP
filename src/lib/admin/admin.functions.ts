import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RemoveUserInput = {
  userId: string;
  reason: string;
  banIp: boolean;
  wipeFiles: boolean;
};

export type RemoveUserResult = { deactivatedOnly: boolean };

/**
 * Privileged user removal. Verifies the caller holds the admin role, then uses
 * the service-role client to wipe files, ban IPs, audit-log and delete the
 * auth user (which cascades the profile row).
 */
export const removeUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RemoveUserInput) => input)
  .handler(async ({ data, context }): Promise<RemoveUserResult> => {
    const { data: callerRoles, error: callerError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (callerError) throw new Error(callerError.message);
    if (!callerRoles?.length) throw new Error("Only admins can remove users");

    if (data.userId === context.userId) throw new Error("You cannot remove your own account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if (targetRoles?.some((row) => row.role === "admin")) {
      throw new Error("Admin accounts are protected");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, last_login_ip")
      .eq("id", data.userId)
      .maybeSingle();

    if (data.wipeFiles) {
      const { data: userFiles } = await supabaseAdmin
        .from("files")
        .select("storage_path")
        .eq("owner_id", data.userId);
      const paths = (userFiles ?? []).map((row) => row.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabaseAdmin.storage.from("user-files").remove(paths);
      }
      await supabaseAdmin.from("files").delete().eq("owner_id", data.userId);
    }

    if (data.banIp && profile?.last_login_ip) {
      await supabaseAdmin.from("blocked_ips").upsert(
        {
          ip_address: profile.last_login_ip,
          reason: `User removal: ${data.reason}`,
          block_type: "manual",
          blocked_by_admin: context.userId,
          is_active: true,
          blocked_at: new Date().toISOString(),
        },
        { onConflict: "ip_address" },
      );
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      admin_email: (context.claims as { email?: string } | null)?.email ?? null,
      action_type: "user_removed",
      target_type: "profile",
      target_id: data.userId,
      details: {
        reason: data.reason,
        banIp: data.banIp,
        wipeFiles: data.wipeFiles,
        email: profile?.email ?? null,
      },
    });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (deleteError) {
      const { error: statusError } = await supabaseAdmin
        .from("profiles")
        .update({ status: "banned" })
        .eq("id", data.userId);
      if (statusError) throw new Error(statusError.message);
      return { deactivatedOnly: true };
    }

    return { deactivatedOnly: false };
  });
