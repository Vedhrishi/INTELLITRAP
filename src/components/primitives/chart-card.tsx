import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  actions,
  loading = false,
  height = 280,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("bg-gradient-card", className)}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton style={{ height }} className="w-full" />
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
