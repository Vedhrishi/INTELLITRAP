import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  sparkline,
  loading = false,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: number;
  hint?: string;
  sparkline?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const deltaTone =
    delta === undefined
      ? ""
      : delta > 0
        ? "text-warning"
        : delta < 0
          ? "text-success"
          : "text-muted-foreground";

  return (
    <Card
      className={cn("bg-gradient-card transition-shadow duration-150 hover:shadow-md", className)}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{label}</p>
          {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        )}
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={cn("text-xs", deltaTone || "text-muted-foreground")}>
            {delta !== undefined ? `${delta > 0 ? "+" : ""}${delta}% vs previous period` : hint}
          </p>
          {sparkline ? <div className="h-8 w-24 shrink-0">{sparkline}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
