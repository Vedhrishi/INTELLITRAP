import type { LucideIcon } from "lucide-react";
import {
  Ban,
  BarChart3,
  Brain,
  Bug,
  Crown,
  FileText,
  FolderLock,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldAlert,
} from "lucide-react";
import type { NavBadgeKey } from "@/lib/tracking/nav-counts";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
  badgeClass?: string;
  iconClass?: string;
};

export const monitoringNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  {
    title: "Live Visitors",
    url: "/visitors",
    icon: Radio,
    badge: "online",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  },
  {
    title: "Threats",
    url: "/threats",
    icon: ShieldAlert,
    badge: "threats",
    badgeClass: "border-red-500/40 bg-red-500/15 text-red-400",
  },
  {
    title: "Honeypot",
    url: "/honeypot",
    icon: Bug,
    badge: "honeypot",
    badgeClass: "border-orange-500/40 bg-orange-500/15 text-orange-400",
  },
  {
    title: "Blocked IPs",
    url: "/blocked-ips",
    icon: Ban,
    badge: "blocked",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-400",
  },
];

export const workspaceNav: NavItem[] = [
  { title: "Secure Files", url: "/files", icon: FolderLock },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  {
    title: "Admin Console",
    url: "/admin/dashboard",
    icon: Crown,
    iconClass: "text-[#facc15]",
  },
  { title: "Threat Intel", url: "/admin/threat-intel", icon: Brain },
  { title: "Audit Log", url: "/admin/audit-log", icon: FileText },
];
