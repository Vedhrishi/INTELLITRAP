import type { Database } from "@/integrations/supabase/types";

export type FileRow = Database["public"]["Tables"]["files"]["Row"];
export type FileAccessLogRow = Database["public"]["Tables"]["file_access_log"]["Row"];

export type FileStatus = "Active" | "Expired" | "Consumed" | "Revoked" | "Private";

export function computeFileStatus(file: FileRow): FileStatus {
  if (!file.is_shared) return "Private";
  if (file.share_revoked) return "Revoked";
  if (file.consumed) return "Consumed";
  if (file.expires_at && new Date(file.expires_at).getTime() < Date.now()) return "Expired";
  return "Active";
}

export const statusBadgeClass: Record<FileStatus, string> = {
  Active: "bg-green-500/15 text-green-400 border-green-500/30",
  Expired: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Consumed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Revoked: "bg-red-500/15 text-red-400 border-red-500/30",
  Private: "bg-[#334155]/40 text-[#94a3b8] border-[#334155]",
};

export const BLOCKED_EXTENSIONS = [".exe", ".sh", ".bat", ".msi", ".cmd", ".vbs", ".ps1", ".jar"];
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
