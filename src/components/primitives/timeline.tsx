import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  tone?: "primary" | "accent" | "success" | "warning" | "destructive" | "muted";
  meta?: ReactNode;
};

const toneClass = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-6 border-l border-border pl-6", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[1.9rem] top-1.5 size-3 rounded-full ring-4 ring-background",
              toneClass[item.tone ?? "muted"],
            )}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <p className="min-w-0 font-medium">{item.title}</p>
            <time className="font-mono-data shrink-0 text-xs text-muted-foreground">
              {item.timestamp}
            </time>
          </div>
          {item.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          {item.meta ? <div className="mt-2">{item.meta}</div> : null}
        </li>
      ))}
    </ol>
  );
}
