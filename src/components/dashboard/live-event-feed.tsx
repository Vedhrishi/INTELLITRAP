import { AnimatePresence, motion } from "framer-motion";
import { Radio } from "lucide-react";
import {
  EVENT_COLOR,
  EVENT_LABEL,
  timeAgo,
  type VisitorEvent,
} from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";

export function LiveEventFeed({ events }: { events: VisitorEvent[] }) {
  return (
    <div className="glass flex h-full min-h-[320px] flex-col rounded-xl">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Radio aria-hidden className="size-4 text-sky-400" />
        <h2 className="text-sm font-semibold">Live activity</h2>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {events.length} events
        </span>
      </header>
      {events.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
          Waiting for activity…
        </p>
      ) : (
        <ul className="max-h-[520px] flex-1 divide-y divide-border/40 overflow-y-auto">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-xs",
                  event.event_type === "blocked" && "bg-red-500/10",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    EVENT_COLOR[event.event_type] ?? "bg-slate-400",
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {EVENT_LABEL[event.event_type] ?? event.event_type}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
                  {event.ip_address}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(event.created_at)}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
