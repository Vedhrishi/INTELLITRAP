import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import type { NavItem } from "./nav-items";

export function AppShell({
  groups,
  topBarContent,
  adminAccent = false,
  children,
}: {
  groups: { label: string; items: NavItem[] }[];
  topBarContent?: ReactNode;
  adminAccent?: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar groups={groups} adminAccent={adminAccent} />
        <SidebarInset className="min-w-0">
          <TopBar>{topBarContent}</TopBar>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
