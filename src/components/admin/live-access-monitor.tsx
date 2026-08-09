import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { toISTTime } from "@/lib/share/format";
import { DECISION_LABEL, RISK_TEXT_CLASS, type RiskLevel, type Visitor } from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";

const DECISION_BADGE: Record<string, string> = {
  granted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  captcha_mfa: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  honeypot: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function LiveAccessMonitor({ visitors }: { visitors: Visitor[] }) {
  return (
    <section className="glass flex h-[420px] flex-col overflow-hidden rounded-xl">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">Live access monitor</h2>
        <span className="font-mono text-[10px] text-muted-foreground">{visitors.length} visitors</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[#0f172a] text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">City / ISP</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visitors.slice(0, 60).map((visitor) => {
                const level = (visitor.risk_level as RiskLevel) in RISK_TEXT_CLASS
                  ? (visitor.risk_level as RiskLevel)
                  : "low";
                return (
                  <motion.tr
                    key={visitor.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className="border-t border-border/40"
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {toISTTime(visitor.first_seen)}
                    </td>
                    <td className="px-3 py-2 font-mono">{visitor.ip_address}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[visitor.city, visitor.isp].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={cn("px-3 py-2 font-semibold", RISK_TEXT_CLASS[level])}>
                      {visitor.risk_score}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(DECISION_BADGE[visitor.access_decision ?? ""] ?? "")}
                      >
                        {DECISION_LABEL[visitor.access_decision ?? ""] ?? "Pending"}
                      </Badge>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
}
