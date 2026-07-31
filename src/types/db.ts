/**
 * Convenience aliases derived FROM the generated Supabase types.
 * Never hand-write duplicates of the schema here.
 */
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type FileRow = Tables["files"]["Row"];
export type FolderRow = Tables["folders"]["Row"];
export type FileShare = Tables["file_shares"]["Row"];
export type SessionRow = Tables["sessions"]["Row"];
export type ThreatEvent = Tables["threat_events"]["Row"];
export type DetectionRule = Tables["detection_rules"]["Row"];
export type AttackerProfile = Tables["attacker_profiles"]["Row"];
export type HoneypotSession = Tables["honeypot_sessions"]["Row"];
export type AiReport = Tables["ai_reports"]["Row"];
export type AuditEntry = Tables["audit_log"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type UserRoleRow = Tables["user_roles"]["Row"];

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Severity = "low" | "medium" | "high" | "critical";
export type ThreatStatus = "open" | "investigating" | "resolved" | "false_positive";
export type RuleAction = "log" | "challenge" | "trap" | "block";
export type ProfileStatus = "active" | "suspended" | "locked";
