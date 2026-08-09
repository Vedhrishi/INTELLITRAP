import { Suspense, lazy, useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Bug, Globe, ShieldAlert, Users, Wifi } from "lucide-react";
import { PageHeader } from "@/components/primitives/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { LiveEventFeed } from "@/components/dashboard/live-event-feed";
import { OnlineVisitorsTable } from "@/components/dashboard/online-visitors-table";
import { VisitorDrawer } from "@/components/dashboard/visitor-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import {
  fetchDashboardStats,
  fetchMapVisitors,
  fetchOnlineVisitors,
  fetchRecentEvents,
  type Visitor,
} from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";

const VisitorMap = lazy(() => import("@/components/dashboard/visitor-map"));

const title = "Live visitor intelligence";
const description =
  "Real-time visitor telemetry, risk scoring and honeypot activity across IntelliTrap.";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function MapSkeleton() {
  return <Skeleton className="h-[420px] w-full rounded-xl" />;
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Visitor | null>(null);

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 15_000,
  });
  const mapVisitors = useQuery({
    queryKey: ["map-visitors"],
    queryFn: fetchMapVisitors,
    refetchInterval: 30_000,
  });
  const events = useQuery({
    queryKey: ["recent-events"],
    queryFn: () => fetchRecentEvents(30),
    refetchInterval: 15_000,
  });
  const online = useQuery({
    queryKey: ["online-visitors"],
    queryFn: () => fetchOnlineVisitors(10),
    refetchInterval: 10_000,
  });

  const refreshAll = useCallback(() => {
    for (const key of ["dashboard-stats", "map-visitors", "recent-events", "online-visitors"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  const status = useRealtimeTables(
    ["visitors", "visitor_events", "blocked_ips", "honeypot_activity"],
    refreshAll,
  );

  const s = stats.data;

  return (
    <>
      <PageHeader
        title={title}
        description="Every visitor, scored and mapped the moment they arrive."
      >
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
            status === "live"
              ? "border-emerald-500/40 text-emerald-400"
              : status === "connecting"
                ? "border-amber-500/40 text-amber-400"
                : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "live"
                ? "bg-emerald-400"
                : status === "connecting"
                  ? "bg-amber-400"
                  : "bg-muted-foreground",
            )}
          />
          {status === "live" ? "Realtime" : status === "connecting" ? "Connecting" : "Polling"}
        </span>
      </PageHeader>

      {stats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            index={0}
            label="Online now"
            value={s?.online ?? 0}
            icon={Wifi}
            accent="bg-emerald-500/15 text-emerald-400"
            isLive
          />
          <KpiCard
            index={1}
            label="Visitors today"
            value={s?.today ?? 0}
            icon={Users}
            accent="bg-sky-500/15 text-sky-400"
          />
          <KpiCard
            index={2}
            label="Unique IPs"
            value={s?.uniqueIps ?? 0}
            icon={Globe}
            accent="bg-indigo-500/15 text-indigo-300"
          />
          <KpiCard
            index={3}
            label="High risk"
            value={s?.highRisk ?? 0}
            icon={ShieldAlert}
            accent="bg-orange-500/15 text-orange-400"
          />
          <KpiCard
            index={4}
            label="In honeypot"
            value={s?.inHoneypot ?? 0}
            icon={Bug}
            accent="bg-orange-500/15 text-orange-400"
          />
          <KpiCard
            index={5}
            label="Blocked IPs"
            value={s?.blocked ?? 0}
            icon={Ban}
            accent="bg-red-500/15 text-red-400"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass overflow-hidden rounded-xl lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">Visitor map</h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {(mapVisitors.data ?? []).length} located
            </span>
          </header>
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <VisitorMap visitors={mapVisitors.data ?? []} onSelect={setSelected} />
            </Suspense>
          </ClientOnly>
        </div>
        <LiveEventFeed events={events.data ?? []} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Who's online</h2>
        {online.isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <OnlineVisitorsTable visitors={online.data ?? []} onSelect={setSelected} />
        )}
      </section>

      <VisitorDrawer
        visitor={selected}
        onClose={() => setSelected(null)}
        onChanged={refreshAll}
      />
    </>
  );
}
