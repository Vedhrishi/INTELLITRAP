import { passwordRules, passwordScore } from "@/lib/auth/auth-schemas";
import { cn } from "@/lib/utils";

const toneByScore = ["bg-muted", "bg-destructive", "bg-warning", "bg-accent", "bg-success"] as const;
const labelByScore = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;

export function PasswordStrength({ value }: { value: string }) {
  const score = passwordScore(value);

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-150",
                index < score ? toneByScore[score] : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{labelByScore[score]}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {passwordRules.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn("text-xs", passed ? "text-success" : "text-muted-foreground")}
            >
              <span aria-hidden className="mr-1 font-mono-data">
                {passed ? "✓" : "•"}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
