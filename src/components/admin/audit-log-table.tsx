import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toIST } from "@/lib/share/format";
import type { AdminAuditLog } from "@/lib/admin/admin-data";
import { cn } from "@/lib/utils";

const ACTION_BADGE: Record<string, string> = {
  user_removed: "bg-red-500/15 text-red-400 border-red-500/30",
  honeypot_escalated: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export function AuditLogTable({ entries }: { entries: AdminAuditLog[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#0f172a] text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Admin</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Target type</th>
            <th className="px-3 py-2 font-medium">Target id</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isOpen = open === entry.id;
            return (
              <Fragment key={entry.id}>
                <tr className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {toIST(entry.created_at)}
                  </td>
                  <td className="px-3 py-2">{entry.admin_email ?? "System"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn(ACTION_BADGE[entry.action_type] ?? "")}>
                      {entry.action_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.target_type ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {entry.target_id ? `${entry.target_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setOpen(isOpen ? null : entry.id)}
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                      Details
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr key={`${entry.id}-details`}>
                    <td colSpan={6} className="p-0">
                      <pre className="overflow-x-auto bg-black/30 p-3 text-[11px] text-muted-foreground">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {entries.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                No audit entries yet
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
