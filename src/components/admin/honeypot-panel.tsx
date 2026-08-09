import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, Download, ShieldOff, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import {
  escalateToBlock,
  fetchHoneypotActivity,
  releaseHoneypot,
  type HoneypotActivity,
  type Visitor,
} from "@/lib/admin/admin-data";
import { useRealtimeTables } from "@/hooks/use-realtime";

function TrapTimer({ since }: { since: string }) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000)),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds(Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [since]);
  return <span className="font-mono font-semibold text-orange-300">In trap: {seconds}s</span>;
}

function HoneypotCard({ visitor }: { visitor: Visitor }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const activity = useQuery({
    queryKey: ["honeypot-activity", visitor.session_token],
    queryFn: () => fetchHoneypotActivity(visitor.session_token),
    refetchInterval: 10_000,
  });

  useRealtimeTables(["honeypot_activity"], (table) => {
    if (table === "honeypot_activity") {
      void queryClient.invalidateQueries({ queryKey: ["honeypot-activity", visitor.session_token] });
    }
  });

  const escalate = useMutation({
    mutationFn: () => escalateToBlock(visitor, { id: user?.id ?? null, email: user?.email ?? null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-honeypots"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      toast.success("Escalated to block");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to escalate"),
  });

  const release = useMutation({
    mutationFn: () => releaseHoneypot(visitor.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-honeypots"] });
      toast.success("Visitor released");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to release"),
  });

  const exportIntel = () => {
    const payload = { visitor, activity: activity.data ?? [] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `intel-${visitor.ip_address}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="honeypot-card rounded-xl border border-orange-500/50 bg-[#1e293b] p-4">
      <header className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-orange-400">🍯 ACTIVE HONEYPOT SESSION</span>
        <TrapTimer since={visitor.honeypot_entered_at ?? visitor.first_seen} />
      </header>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{visitor.ip_address}</span>
        <span>{visitor.city ?? "Unknown city"}</span>
        <span>{visitor.isp ?? "Unknown ISP"}</span>
        <span>
          {visitor.device_type ?? "device"} · {visitor.browser ?? "browser"} · {visitor.os ?? "os"}
        </span>
      </div>

      <div className="mb-3 h-28 overflow-y-auto rounded-md border border-border/40 bg-black/20 p-2">
        <AnimatePresence initial={false}>
          {(activity.data ?? []).map((entry: HoneypotActivity) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 py-0.5 text-[11px]"
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  entry.action === "download" ? "bg-orange-500" : "bg-slate-500"
                }`}
              />
              <span className="text-muted-foreground">
                [{Math.round((Date.now() - new Date(entry.created_at).getTime()) / 1000)}s ago]
              </span>
              <span>
                {entry.action === "download"
                  ? `Downloaded: ${entry.decoy_file_name ?? "unknown file"}`
                  : entry.action}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {activity.data?.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-muted-foreground">No activity yet</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={escalate.isPending}
          onClick={() => escalate.mutate()}
        >
          <ShieldOff className="mr-1 size-3.5" /> Escalate to Block
        </Button>
        <Button variant="outline" size="sm" disabled={release.isPending} onClick={() => release.mutate()}>
          <DoorOpen className="mr-1 size-3.5" /> Release
        </Button>
        <Button variant="outline" size="sm" onClick={exportIntel}>
          <Download className="mr-1 size-3.5" /> Export Intel
        </Button>
      </div>
    </div>
  );
}

export function HoneypotPanel({ visitors }: { visitors: Visitor[] }) {
  return (
    <section className="glass rounded-xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Active honeypot sessions</h2>
      {visitors.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Bug className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No active honeypot sessions</p>
          <p className="text-xs text-muted-foreground">
            High-risk visitors will appear here automatically
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visitors.map((visitor) => (
            <HoneypotCard key={visitor.id} visitor={visitor} />
          ))}
        </div>
      )}
    </section>
  );
}
