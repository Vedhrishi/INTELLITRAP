import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "muted" | "primary" | "accent";

const toneClass: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
  primary: "bg-primary",
  accent: "bg-accent",
};

export function StatusDot({
  tone = "muted",
  label,
  pulse = false,
  className,
}: {
  tone?: StatusTone;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className="relative flex size-2.5 shrink-0">
        {pulse ? (
          <span
            aria-hidden
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              toneClass[tone],
            )}
          />
        ) : null}
        <span
          aria-hidden
          className={cn("relative inline-flex size-2.5 rounded-full", toneClass[tone])}
        />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
