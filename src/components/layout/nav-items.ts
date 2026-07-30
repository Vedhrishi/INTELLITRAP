import type { LucideIcon } from "lucide-react";
import {
  Files,
  LayoutDashboard,
  Share2,
  Trash2,
  UserCog,
  Activity,
  Bot,
  ScrollText,
  ShieldAlert,
  Skull,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export type NavItem = { title: string; url: string; icon: LucideIcon };

export const userNav: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Files", url: "/app/files", icon: Files },
  { title: "Shared", url: "/app/shared", icon: Share2 },
  { title: "Trash", url: "/app/trash", icon: Trash2 },
  { title: "Profile", url: "/app/profile", icon: UserCog },
];

export const adminNav: NavItem[] = [
  { title: "Overview", url: "/admin", icon: Activity },
  { title: "Threats", url: "/admin/threats", icon: ShieldAlert },
  { title: "Attackers", url: "/admin/attackers", icon: Skull },
  { title: "Honeypot", url: "/admin/honeypot", icon: Bot },
  { title: "AI Reports", url: "/admin/ai", icon: Bot },
  { title: "Rules", url: "/admin/rules", icon: SlidersHorizontal },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Audit Log", url: "/admin/audit", icon: ScrollText },
];
