import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/primitives/logo";
import { fetchNavCounts, type NavCounts } from "@/lib/tracking/nav-counts";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

export function AppSidebar({
  groups,
  adminAccent = false,
}: {
  groups: { label: string; items: NavItem[] }[];
  adminAccent?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const counts = useQuery<NavCounts>({
    queryKey: ["nav-counts"],
    queryFn: fetchNavCounts,
    refetchInterval: 20_000,
  });

  return (
    <Sidebar
      collapsible="icon"
      className={adminAccent ? "border-t-[3px] border-t-[#7f1d1d]" : undefined}
    >
      <SidebarHeader className="px-3 py-4">
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const count = item.badge ? (counts.data?.[item.badge] ?? 0) : 0;
                  const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          active && "border-l-2 border-l-[#3b82f6] bg-blue-500/10",
                        )}
                      >
                        <Link to={item.url}>
                          <item.icon aria-hidden className={cn("size-4", item.iconClass)} />
                          <span>{item.title}</span>
                          {count > 0 ? (
                            <span
                              className={cn(
                                "ml-auto rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none",
                                item.badgeClass,
                              )}
                            >
                              {count}
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
