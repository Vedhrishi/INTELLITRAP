import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
        <ShieldCheck aria-hidden className="size-4.5" />
      </span>
      {showText ? (
        <span className="truncate text-base font-semibold tracking-tight">IntelliTrap</span>
      ) : null}
    </span>
  );
}
