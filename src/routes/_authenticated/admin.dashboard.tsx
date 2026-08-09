import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Crown } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminEventStream } from "@/components/admin/admin-event-stream";
import { UsersTable } from "@/components/admin/users-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { fetchAdminKpis, fetchRecentEventsAll } from "@/lib/admin/admin-data";
import { Users, UserCheck, Ban, Bug, ShieldAlert, HeartPulse } from "lucide-react";

const title = "Admin console";
const description = "Full platform visibility, user administration and live threat telemetry.";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  return (
    <RoleGuard role="admin">
      <AdminLayout>
        <AdminDashboardContent />
      </AdminLayout>
    </RoleGuard>
  );
}

function AdminDashboardContent() {
  const queryClient = useQueryClient();

  const kpis = useQuery({
    queryKey: ["admin-kpis"],
    queryFn: fetchAdminKpis,
    refetchInterval: 20_000,
  });
  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => fetchRecentEventsAll(40),
    refetchInterval: 10_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-kpis"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
  }, [queryClient]);

  useRealtimeTables(["visitor_events", "visitors", "blocked_ips"], refresh);

  const k = kpis.data;

  return (
    <>
      <div className="flex items-center gap-2">
        <Crown aria-hidden className="size-6 text-[#facc15]" />
        <div>
          <h1 className="text-xl font-semibold">Admin Console</h1>
          <p className="text-sm text-muted-foreground">Full platform visibility</p>
        </div>
      </div>

      {kpis.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard index={0} label="Total users" value={k?.totalUsers ?? 0} icon={Users} accent="bg-sky-500/15 text-sky-400" />
          <KpiCard index={1} label="Visitors today" value={k?.visitorsToday ?? 0} icon={UserCheck} accent="bg-emerald-500/15 text-emerald-400" />
          <KpiCard index={2} label="Auto-blocks today" value={k?.autoBlocksToday ?? 0} icon={Ban} accent="bg-red-500/15 text-red-400" />
          <KpiCard index={3} label="Active honeypots" value={k?.activeHoneypots ?? 0} icon={Bug} accent="bg-orange-500/15 text-orange-400" />
          <KpiCard index={4} label="Critical risk now" value={k?.criticalRiskNow ?? 0} icon={ShieldAlert} accent="bg-red-500/15 text-red-400" />
          <KpiCard index={5} label="Platform health" value={k?.platformHealth ?? 100} icon={HeartPulse} accent="bg-emerald-500/15 text-emerald-400" />
        </div>
      )}

      <AdminEventStream events={events.data ?? []} />

      <UsersTable />
    </>
  );
}
