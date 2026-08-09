import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toIST } from "@/lib/share/format";
import { liftBlock, type BlockedIp } from "@/lib/admin/admin-data";

function scoreClass(score: number | null): string {
  if (score === null) return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  if (score >= 60) return "bg-red-500/15 text-red-400 border-red-500/30";
  if (score >= 40) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

export function AutoBlocksTable({ blocks }: { blocks: BlockedIp[] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const liftMutation = useMutation({
    mutationFn: (id: string) => liftBlock(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      toast.success("Block lifted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to lift block"),
  });

  const exportJson = (block: BlockedIp) => {
    const blob = new Blob([JSON.stringify(block, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `block-${block.ip_address}-${block.id.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <section className="glass overflow-hidden rounded-xl">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">Auto-blocks</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{blocks.length} active</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">City / ISP</th>
                <th className="px-3 py-2 font-medium">Signals</th>
                <th className="px-3 py-2 font-medium">Alerted</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => {
                const geo = (block.geo_snapshot ?? {}) as { city?: string; isp?: string };
                const isExpanded = expanded === block.id;
                return (
                  <tr key={block.id} className="border-t border-border/40 align-top">
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {toIST(block.blocked_at)}
                    </td>
                    <td className="px-3 py-2 font-mono">{block.ip_address}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={scoreClass(block.trigger_score)}>
                        {block.trigger_score ?? "—"}
                      </Badge>
                    </td>
                    <td
                      className="max-w-[220px] cursor-pointer px-3 py-2 text-muted-foreground"
                      onClick={() => setExpanded(isExpanded ? null : block.id)}
                    >
                      <span className={isExpanded ? "" : "line-clamp-1"}>{block.reason}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {geo.city ?? "—"} {geo.isp ? `· ${geo.isp}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            {block.trigger_signals?.length ?? 0}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {block.trigger_signals?.length
                            ? block.trigger_signals.join(", ")
                            : "No signals recorded"}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      {block.admin_alerted ? (
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      ) : (
                        <X className="size-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => exportJson(block)}>
                          Export JSON
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={liftMutation.isPending}
                          onClick={() => liftMutation.mutate(block.id)}
                        >
                          Lift Block
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {blocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No active blocks
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </TooltipProvider>
  );
}
