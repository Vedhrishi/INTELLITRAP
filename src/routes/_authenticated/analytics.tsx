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

  const riskDistribution = [
    { name: "Low", value: rows.filter((v) => v.risk_level === "low").length, color: "#22c55e" },
    {
      name: "Medium",
      value: rows.filter((v) => v.risk_level === "medium").length,
      color: "#f59e0b",
    },
    { name: "High", value: rows.filter((v) => v.risk_level === "high").length, color: "#f97316" },
    {
      name: "Critical",
      value: rows.filter((v) => v.risk_level === "critical").length,
      color: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  const cityMap: Record<string, number> = {};
  for (const v of rows) {
    if (v.city) cityMap[v.city] = (cityMap[v.city] ?? 0) + 1;
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([city, count]) => ({ city, count }));

  const decisions = [
    {
      name: "Granted",
      value: rows.filter((v) => v.access_decision === "granted").length,
      fill: "#22c55e",
    },
    {
      name: "Challenged",
      value: rows.filter((v) => v.access_decision === "captcha_mfa").length,
      fill: "#f59e0b",
    },
    {
      name: "Honeypot",
      value: rows.filter((v) => v.access_decision === "honeypot").length,
      fill: "#f97316",
    },
    {
      name: "Blocked",
      value: rows.filter((v) => v.access_decision === "blocked").length,
      fill: "#ef4444",
    },
  ].filter((d) => d.value > 0);



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
