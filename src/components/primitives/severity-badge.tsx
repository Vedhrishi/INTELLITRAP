import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low";

const severityBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      severity: {
        critical: "border-destructive/40 bg-destructive/12 text-destructive",
        high: "border-warning/40 bg-warning/12 text-warning",
        medium: "border-accent/40 bg-accent/12 text-accent",
        low: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { severity: "low" },
  },
);

const severityGlyph: Record<Severity, string> = {
  critical: "!!!",
  high: "!!",
  medium: "!",
  low: "·",
};

export function SeverityBadge({
  severity,
  className,
  ...props
}: { severity: Severity; className?: string } & VariantProps<typeof severityBadgeVariants>) {
  return (
    <span className={cn(severityBadgeVariants({ severity }), className)} {...props}>
      <span aria-hidden className="font-mono-data text-[0.65rem] leading-none">
        {severityGlyph[severity]}
      </span>
      {severity}
    </span>
  );
}
