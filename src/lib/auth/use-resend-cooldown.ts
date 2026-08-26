import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "intellitrap.resend.";

function deadlineKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`;
}

function readDeadline(scope: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(deadlineKey(scope));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function secondsLeft(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** "0:47" */
export function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Countdown for "resend email" buttons. The deadline is persisted per scope in
 * sessionStorage so a refresh or a back-navigation can't reset it and let the
 * user trip the server-side send limit.
 */
export function useResendCooldown(scope: string, defaultSeconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-read on mount (and whenever the scope changes) so the timer survives
  // reloads instead of restarting from zero.
  useEffect(() => {
    setRemaining(secondsLeft(readDeadline(scope)));
  }, [scope]);

  useEffect(() => {
    if (remaining <= 0) return;
    timer.current = setInterval(() => {
      setRemaining(secondsLeft(readDeadline(scope)));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [remaining, scope]);

  /** Start (or extend) the cooldown. Pass the server's N when it named one. */
  const start = useCallback(
    (seconds?: number | null) => {
      const span = Math.max(1, seconds && seconds > 0 ? seconds : defaultSeconds);
      const deadline = Date.now() + span * 1000;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(deadlineKey(scope), String(deadline));
      }
      setRemaining(secondsLeft(deadline));
    },
    [defaultSeconds, scope],
  );

  const clear = useCallback(() => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(deadlineKey(scope));
    setRemaining(0);
  }, [scope]);

  return {
    remaining,
    active: remaining > 0,
    label: formatCooldown(remaining),
    start,
    clear,
  };
}
