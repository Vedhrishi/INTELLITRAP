import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "connecting" | "live" | "offline";

/**
 * Subscribes to postgres changes on the given tables and calls onChange.
 * The channel is always torn down on unmount to avoid subscription leaks.
 */
export function useRealtimeTables(
  tables: string[],
  onChange: (table: string, payload: unknown) => void,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const handler = useRef(onChange);
  handler.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    const channel = supabase.channel(`realtime:${key}`);
    for (const table of list) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        handler.current(table, payload);
      });
    }
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") setStatus("live");
      else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED")
        setStatus("offline");
      else setStatus("connecting");
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key]);

  return status;
}

/** Animates a number from 0 to value using requestAnimationFrame. */
export function useCountUp(value: number, durationMs = 1200): number {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(initial + (value - initial) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return display;
}
