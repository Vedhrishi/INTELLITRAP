import type { ReactNode } from "react";
import { Activity, LayoutDashboard, Radar } from "lucide-react";
import { AppShell } from "./app-shell";
import type { NavItem } from "./nav-items";
import { useAuth } from "@/lib/auth/auth-context";

// Phase 2 ships the routes that exist today; later phases extend these groups.
const workspaceNav: NavItem[] = [{ title: "Dashboard", url: "/app", icon: LayoutDashboard }];
const securityNav: NavItem[] = [
  { title: "Live intelligence", url: "/dashboard", icon: Radar },
  { title: "Overview", url: "/admin", icon: Activity },
];


export function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  const groups = [
    { label: "Workspace", items: workspaceNav },
    ...(isAdmin ? [{ label: "Security", items: securityNav }] : []),
  ];

  return <AppShell groups={groups}>{children}</AppShell>;
}
