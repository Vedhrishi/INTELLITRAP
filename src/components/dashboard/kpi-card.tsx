import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  isLive = false,
  index = 0,
  sublabel,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
  isLive?: boolean;
  index?: number;
  sublabel?: string;
}) {
  const display = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("rounded-lg p-2", accent)}>
          <Icon aria-hidden className="size-4" />
        </div>
        {isLive && value > 0 ? (
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-4 font-mono text-3xl font-semibold tabular-nums",
          value === 0 ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {display}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {sublabel ? <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p> : null}
    </motion.div>
  );
}
