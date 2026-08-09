import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/primitives/page-header";
import { OnlineVisitorsTable } from "@/components/dashboard/online-visitors-table";
import { VisitorDrawer } from "@/components/dashboard/visitor-drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { fetchActiveVisitors } from "@/lib/admin/admin-data";
import { isOnline, type Visitor } from "@/lib/tracking/dashboard-data";

const title = "Live visitors";
const description = "Every tracked session, filterable by presence, risk and region.";

const FILTERS = ["All", "Online now", "High risk", "India only"] as const;
type Filter = (typeof FILTERS)[number];

export const Route = createFileRoute("/_authenticated/visitors")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<Visitor | null>(null);

  const visitors = useQuery({
    queryKey: ["all-visitors"],
    queryFn: fetchActiveVisitors,
    refetchInterval: 15_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["all-visitors"] });
  }, [queryClient]);

  useRealtimeTables(["visitors"], refresh);

  const rows = useMemo(() => {
    const all = visitors.data ?? [];
    if (filter === "Online now") return all.filter(isOnline);
    if (filter === "High risk")
      return all.filter((v) => v.risk_level === "high" || v.risk_level === "critical");
    if (filter === "India only") return all.filter((v) => v.country_code === "IN");
    return all;
  }, [filter, visitors.data]);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Radio aria-hidden className="size-4" />
            {rows.length} sessions
          </span>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={filter === option ? "default" : "outline"}
            onClick={() => setFilter(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      {visitors.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <OnlineVisitorsTable visitors={rows} onSelect={setSelected} />
      )}

      <VisitorDrawer visitor={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </>
  );
}
