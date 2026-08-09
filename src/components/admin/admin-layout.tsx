import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/threat-intel", label: "Threat Intel" },
  { to: "/admin/audit-log", label: "Audit Log" },
  { to: "/admin/settings", label: "Settings" },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-m-6 min-h-full border-t-[3px] border-[#7f1d1d] p-6 sm:-m-8 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7f1d1d]/40 bg-[#1e293b]/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Crown aria-hidden className="size-5 text-[#facc15]" />
          <span className="text-sm font-semibold tracking-wide">IntelliTrap Admin</span>
          <span className="flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 animate-pulse">
            <span className="size-1.5 rounded-full bg-red-500" />
            Admin Mode
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-1 text-xs">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                "[&.active]:bg-[#7f1d1d]/30 [&.active]:text-foreground",
              )}
              activeProps={{ className: "active" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
