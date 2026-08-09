import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/primitives/page-header";
import { RiskSignalChart } from "@/components/admin/risk-signal-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchActiveVisitors, fetchTodaySignalFrequency } from "@/lib/admin/admin-data";
import { isOnline } from "@/lib/tracking/dashboard-data";
import { Activity, Bug, ShieldAlert, Users } from "lucide-react";


const title = "Analytics";
const description = "Traffic, risk distribution and deception outcomes at a glance.";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const visitors = useQuery({
    queryKey: ["analytics-visitors"],
    queryFn: fetchActiveVisitors,
    refetchInterval: 30_000,
  });
  const signals = useQuery({
    queryKey: ["analytics-signals"],
    queryFn: fetchTodaySignalFrequency,
    refetchInterval: 30_000,
  });

  const rows = visitors.data ?? [];
  const online = rows.filter(isOnline).length;
  const highRisk = rows.filter(
    (v) => v.risk_level === "high" || v.risk_level === "critical",
  ).length;
  const trapped = rows.filter((v) => v.in_honeypot).length;

  return (
    <>
      <PageHeader title={title} description={description} />

      {visitors.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            index={0}
            label="Sessions tracked"
            value={rows.length}
            icon={Users}
            accent="bg-sky-500/15 text-sky-400"
          />
          <KpiCard
            index={1}
            label="Online now"
            value={online}
            icon={Activity}
            accent="bg-emerald-500/15 text-emerald-400"
          />
          <KpiCard
            index={2}
            label="High risk"
            value={highRisk}
            icon={ShieldAlert}
            accent="bg-red-500/15 text-red-400"
          />
          <KpiCard
            index={3}
            label="In honeypot"
            value={trapped}
            icon={Bug}
            accent="bg-orange-500/15 text-orange-400"
          />
        </div>
      )}

      {signals.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <RiskSignalChart data={signals.data ?? []} />
      )}
    </>
  );
}
