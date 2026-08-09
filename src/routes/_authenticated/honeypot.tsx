import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/primitives/page-header";
import { HoneypotPanel } from "@/components/admin/honeypot-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { fetchActiveVisitors } from "@/lib/admin/admin-data";

const title = "Honeypot";
const description = "Sessions diverted into the deception layer and what they touched.";

export const Route = createFileRoute("/_authenticated/honeypot")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HoneypotPage,
});

function HoneypotPage() {
  const queryClient = useQueryClient();

  const visitors = useQuery({
    queryKey: ["honeypot-visitors"],
    queryFn: fetchActiveVisitors,
    refetchInterval: 15_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["honeypot-visitors"] });
  }, [queryClient]);

  useRealtimeTables(["visitors", "honeypot_activity"], refresh);

  const trapped = (visitors.data ?? []).filter(
    (visitor) => visitor.in_honeypot || visitor.decoy_files_downloaded.length > 0,
  );

  return (
    <>
      <PageHeader title={title} description={description} />
      {visitors.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <HoneypotPanel visitors={trapped} />
      )}
    </>
  );
}
