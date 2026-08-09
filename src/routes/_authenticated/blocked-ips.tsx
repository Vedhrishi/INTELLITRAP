import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/primitives/page-header";
import { AutoBlocksTable } from "@/components/admin/auto-blocks-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { fetchActiveBlocks } from "@/lib/admin/admin-data";

const title = "Blocked IPs";
const description = "Every active block, with the signals and score that triggered it.";

export const Route = createFileRoute("/_authenticated/blocked-ips")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlockedIpsPage,
});

function BlockedIpsPage() {
  const queryClient = useQueryClient();

  const blocks = useQuery({
    queryKey: ["active-blocks"],
    queryFn: fetchActiveBlocks,
    refetchInterval: 20_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["active-blocks"] });
  }, [queryClient]);

  useRealtimeTables(["blocked_ips"], refresh);

  return (
    <>
      <PageHeader title={title} description={description} />
      {blocks.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <AutoBlocksTable blocks={blocks.data ?? []} />
      )}
    </>
  );
}
