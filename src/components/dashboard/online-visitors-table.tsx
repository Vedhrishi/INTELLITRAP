import { motion } from "framer-motion";
import { Users } from "lucide-react";
import {
  DECISION_LABEL,
  RISK_TEXT_CLASS,
  timeAgo,
  type RiskLevel,
  type Visitor,
} from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function GeoBadges({ visitor }: { visitor: Visitor }) {
  return (
    <span className="flex flex-wrap gap-1">
      {visitor.is_hosting ? (
        <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-400">
          DC
        </Badge>
      ) : null}
      {visitor.is_proxy ? (
        <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">
          VPN
        </Badge>
      ) : null}
      {visitor.is_mobile_network ? (
        <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-400">
          Mobile
        </Badge>
      ) : null}
    </span>
  );
}

export function OnlineVisitorsTable({
  visitors,
  onSelect,
}: {
  visitors: Visitor[];
  onSelect: (visitor: Visitor) => void;
}) {
  if (visitors.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-xl px-6 py-12 text-center">
        <Users aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No one online right now</p>
        <p className="text-xs text-muted-foreground">
          Live sessions appear here the moment someone opens the site.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-x-auto rounded-xl">
      <table className="w-full min-w-[820px] text-left text-xs">
        <thead className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">IP</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Device</th>
            <th className="px-4 py-3 font-medium">Page</th>
            <th className="px-4 py-3 font-medium">Activity</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">Decision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {visitors.map((visitor, index) => (
            <motion.tr
              key={visitor.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.3) }}
              onClick={() => onSelect(visitor)}
              className="cursor-pointer transition-colors hover:bg-foreground/5"
            >
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Online
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px]">{visitor.ip_address}</span>
                  <GeoBadges visitor={visitor} />
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {[visitor.city, visitor.country].filter(Boolean).join(", ") || "Unknown"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {visitor.browser ?? "?"} · {visitor.os ?? "?"}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                {visitor.current_page ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {visitor.page_views} views · {timeAgo(visitor.last_heartbeat)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "font-mono font-semibold",
                    RISK_TEXT_CLASS[visitor.risk_level as RiskLevel],
                  )}
                >
                  {visitor.risk_score}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {visitor.access_decision ? DECISION_LABEL[visitor.access_decision] : "—"}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
