import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { adminNav, monitoringNav, workspaceNav } from "./nav-items";
import { useAuth } from "@/lib/auth/auth-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  const groups = [
    { label: "Monitoring", items: monitoringNav },
    { label: "Workspace", items: workspaceNav },
    ...(isAdmin ? [{ label: "Admin", items: adminNav }] : []),
  ];

  return (
    <AppShell groups={groups} adminAccent={isAdmin}>
      {children}
    </AppShell>
  );
}
