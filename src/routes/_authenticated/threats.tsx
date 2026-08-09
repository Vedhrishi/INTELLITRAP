import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/primitives/page-header";
import { OnlineVisitorsTable } from "@/components/dashboard/online-visitors-table";
import { VisitorDrawer } from "@/components/dashboard/visitor-drawer";
import { RiskSignalChart } from "@/components/admin/risk-signal-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { fetchActiveVisitors, fetchTodaySignalFrequency } from "@/lib/admin/admin-data";
import type { Visitor } from "@/lib/tracking/dashboard-data";

const title = "Threats";
const description = "High and critical risk sessions, with today's most common attack signals.";

export const Route = createFileRoute("/_authenticated/threats")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThreatsPage,
});

function ThreatsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Visitor | null>(null);

  const visitors = useQuery({
    queryKey: ["threat-visitors"],
    queryFn: fetchActiveVisitors,
    refetchInterval: 15_000,
  });
  const signals = useQuery({
    queryKey: ["threat-signals"],
    queryFn: fetchTodaySignalFrequency,
    refetchInterval: 30_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["threat-visitors"] });
    void queryClient.invalidateQueries({ queryKey: ["threat-signals"] });
  }, [queryClient]);

  useRealtimeTables(["visitors", "visitor_events"], refresh);

  const rows = (visitors.data ?? []).filter(
    (visitor) => visitor.risk_level === "high" || visitor.risk_level === "critical",
  );

  return (
    <>
      <PageHeader title={title} description={description} />

      {visitors.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <OnlineVisitorsTable visitors={rows} onSelect={setSelected} />
      )}

      {signals.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <RiskSignalChart data={signals.data ?? []} />
      )}

      <VisitorDrawer visitor={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </>
  );
}
