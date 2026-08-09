import { AnimatePresence, motion } from "framer-motion";
import { EVENT_LABEL, type VisitorEvent } from "@/lib/tracking/dashboard-data";
import { toISTTime } from "@/lib/share/format";
import { severityColor } from "@/lib/admin/admin-data";

export function AdminEventStream({ events }: { events: VisitorEvent[] }) {
  return (
    <div className="glass flex h-[400px] flex-col overflow-hidden rounded-xl">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">Live event stream</h2>
        <span className="font-mono text-[10px] text-muted-foreground">{events.length} events</span>
      </header>
      <div className="relative flex-1 overflow-y-auto">
        <ul className="divide-y divide-border/40">
          <AnimatePresence initial={false}>
            {events.slice(0, 40).map((event) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="flex items-center gap-3 border-l-2 px-4 py-2 text-xs"
                style={{ borderLeftColor: severityColor(event.event_type) }}
              >
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {toISTTime(event.created_at)}
                </span>
                <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium">
                  {EVENT_LABEL[event.event_type] ?? event.event_type}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {event.ip_address}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                  {event.page_path ?? ""}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {event.session_token.slice(0, 8)}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
      <div className="border-t border-border/60 px-4 py-1.5 text-right text-[10px] text-muted-foreground">
        Cannot be paused
      </div>
    </div>
  );
}
