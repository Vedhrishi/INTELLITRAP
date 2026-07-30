import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "./user-menu";

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger aria-label="Toggle navigation" />
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

