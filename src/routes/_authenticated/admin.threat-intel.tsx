import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { LiveAccessMonitor } from "@/components/admin/live-access-monitor";
import { HoneypotPanel } from "@/components/admin/honeypot-panel";
import { AutoBlocksTable } from "@/components/admin/auto-blocks-table";
import { RiskSignalChart } from "@/components/admin/risk-signal-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import {
  fetchActiveBlocks,
  fetchActiveHoneypots,
  fetchActiveVisitors,
  fetchTodaySignalFrequency,
} from "@/lib/admin/admin-data";

const title = "Threat intelligence";
const description = "Live access telemetry, active honeypot sessions and auto-block history.";

export const Route = createFileRoute("/_authenticated/admin/threat-intel")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminThreatIntelPage,
});

function AdminThreatIntelPage() {
  return (
    <RoleGuard role="admin">
      <AdminLayout>
        <AdminThreatIntelContent />
      </AdminLayout>
    </RoleGuard>
  );
}

function AdminThreatIntelContent() {
  const queryClient = useQueryClient();

  const visitors = useQuery({
    queryKey: ["admin-visitors"],
    queryFn: fetchActiveVisitors,
    refetchInterval: 15_000,
  });
  const honeypots = useQuery({
    queryKey: ["admin-honeypots"],
    queryFn: fetchActiveHoneypots,
    refetchInterval: 10_000,
  });
  const blocks = useQuery({
    queryKey: ["admin-blocks"],
    queryFn: fetchActiveBlocks,
    refetchInterval: 15_000,
  });
  const signals = useQuery({
    queryKey: ["admin-signal-frequency"],
    queryFn: fetchTodaySignalFrequency,
    refetchInterval: 30_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-visitors"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-honeypots"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-signal-frequency"] });
  }, [queryClient]);

  useRealtimeTables(["visitors", "blocked_ips", "visitor_events"], refresh);

  return (
    <>
      <div className="flex items-center gap-2">
        <Radar aria-hidden className="size-6 text-[#facc15]" />
        <div>
          <h1 className="text-xl font-semibold">Threat Intelligence</h1>
          <p className="text-sm text-muted-foreground">Live access monitor and honeypot control</p>
        </div>
      </div>

      {visitors.isLoading ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : (
        <LiveAccessMonitor visitors={visitors.data ?? []} />
      )}

      {honeypots.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <HoneypotPanel visitors={honeypots.data ?? []} />
      )}

      {blocks.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <AutoBlocksTable blocks={blocks.data ?? []} />
      )}

      {signals.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <RiskSignalChart data={signals.data ?? []} />
      )}
    </>
  );
}
