import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Ban, Bug, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_COLOR,
  EVENT_LABEL,
  RISK_TEXT_CLASS,
  fetchVisitorTimeline,
  timeAgo,
  type RiskLevel,
  type Visitor,
} from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 px-5 py-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function VisitorDrawer({
  visitor,
  onClose,
  onChanged,
}: {
  visitor: Visitor | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visitor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visitor, onClose]);

  const timeline = useQuery({
    queryKey: ["visitor-timeline", visitor?.session_token],
    queryFn: () => fetchVisitorTimeline(visitor?.session_token ?? ""),
    enabled: Boolean(visitor),
  });

  async function blockIp() {
    if (!visitor) return;
    setBusy(true);
    const { error } = await supabase.from("blocked_ips").upsert(
      {
        ip_address: visitor.ip_address,
        session_token: visitor.session_token,
        visitor_id: visitor.visitor_id,
        block_type: "manual",
        reason: "Blocked manually from the dashboard",
        trigger_score: visitor.risk_score,
        is_active: true,
      },
      { onConflict: "ip_address" },
    );
    setBusy(false);
    setConfirmBlock(false);
    if (error) {
      toast.error("Couldn't block that IP. You may not have permission.");
      return;
    }
    toast.success(`${visitor.ip_address} is blocked.`);
    onChanged?.();
  }

  async function sendToHoneypot() {
    if (!visitor) return;
    setBusy(true);
    const { error } = await supabase
      .from("ip_intelligence")
      .update({ threat_classification: "attacker", is_whitelisted: false })
      .eq("ip_address", visitor.ip_address);
    setBusy(false);
    if (error) {
      toast.error("Couldn't flag that visitor.");
      return;
    }
    toast.success("Visitor flagged — next access attempt is trapped.");
    onChanged?.();
  }

  async function whitelist() {
    if (!visitor) return;
    setBusy(true);
    const { error } = await supabase
      .from("ip_intelligence")
      .update({ is_whitelisted: true, is_blacklisted: false, threat_classification: "benign" })
      .eq("ip_address", visitor.ip_address);
    setBusy(false);
    if (error) {
      toast.error("Couldn't whitelist that IP.");
      return;
    }
    toast.success("IP whitelisted.");
    onChanged?.();
  }

  const breakdown = (visitor?.risk_breakdown ?? {}) as Record<string, number>;
  const inhumanTyping =
    visitor?.avg_keystroke_interval_ms !== null &&
    visitor?.avg_keystroke_interval_ms !== undefined &&
    visitor.avg_keystroke_interval_ms < 60;
  const noScrolls = Boolean(visitor && visitor.scroll_events === 0 && visitor.page_views > 1);

  return (
    <AnimatePresence>
      {visitor ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-label={`Visitor ${visitor.ip_address}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] flex-col overflow-y-auto border-l border-border bg-card"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="font-mono text-sm font-semibold">{visitor.ip_address}</p>
                <p className="text-xs text-muted-foreground">
                  {[visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") ||
                    "Location unknown"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
                <X className="size-4" />
              </Button>
            </header>

            <Section title="Risk">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "font-mono text-4xl font-bold",
                    RISK_TEXT_CLASS[visitor.risk_level as RiskLevel],
                  )}
                >
                  {visitor.risk_score}
                </span>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit uppercase">
                    {visitor.risk_level}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {visitor.access_decision ?? "not assessed"}
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {Object.keys(breakdown).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No risk factors detected.</p>
                ) : (
                  Object.entries(breakdown).map(([factor, points]) => (
                    <div key={factor} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{factor}</span>
                      <span className="font-mono text-amber-400">+{points}</span>
                    </div>
                  ))
                )}
              </div>
              {Array.isArray(visitor.risk_signals) && visitor.risk_signals.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(visitor.risk_signals as string[]).map((signal) => (
                    <span
                      key={signal}
                      className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
            </Section>


            <Section title="Network">
              <Row label="Country" value={visitor.country} />
              <Row label="City" value={visitor.city} />
              <Row label="ISP" value={visitor.isp} />
              <Row label="ASN" value={visitor.asn} />
              <Row label="Datacenter" value={visitor.is_hosting ? "Yes" : "No"} />
              <Row label="Proxy / VPN" value={visitor.is_proxy ? "Yes" : "No"} />
            </Section>

            <Section title="Device">
              <Row
                label="Browser"
                value={`${visitor.browser ?? "?"} ${visitor.browser_version ?? ""}`}
              />
              <Row label="OS" value={`${visitor.os ?? "?"} ${visitor.os_version ?? ""}`} />
              <Row label="Screen" value={visitor.screen_resolution} />
              <Row label="CPU cores" value={visitor.hardware_concurrency} />
              <Row
                label="Memory"
                value={visitor.device_memory ? `${visitor.device_memory} GB` : null}
              />
              <Row label="Touch" value={visitor.touch_support ? "Yes" : "No"} />
              <pre className="mt-2 max-h-24 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                {visitor.user_agent ?? "No user agent"}
              </pre>
            </Section>

            <Section title="Behaviour">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Mouse", value: visitor.mouse_movements },
                  { label: "Keys", value: visitor.keystrokes },
                  { label: "Clicks", value: visitor.clicks },
                  { label: "Scrolls", value: visitor.scroll_events },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="font-mono text-lg font-semibold">{tile.value}</p>
                    <p className="text-[10px] text-muted-foreground">{tile.label}</p>
                  </div>
                ))}
              </div>
              {inhumanTyping ? (
                <p className="mt-2 text-xs text-amber-400">
                  Inhuman typing speed ({visitor.avg_keystroke_interval_ms}ms average)
                </p>
              ) : null}
              {noScrolls ? (
                <p className="mt-1 text-xs text-amber-400">No scrolling across multiple pages</p>
              ) : null}
            </Section>

            <Section title="Journey">
              <Row label="Entry page" value={visitor.entry_page} />
              <Row label="Current page" value={visitor.current_page} />
              <div className="mt-2 flex flex-wrap gap-1">
                {visitor.pages_visited.map((page) => (
                  <Badge key={page} variant="secondary" className="font-mono text-[10px]">
                    {page}
                  </Badge>
                ))}
              </div>
            </Section>

            <Section title="Timeline">
              {timeline.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading events…</p>
              ) : timeline.isError ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Couldn't load this timeline.</p>
                  <Button size="sm" variant="outline" onClick={() => void timeline.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : (timeline.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No events recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(timeline.data ?? []).map((event) => (
                    <li key={event.id} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          EVENT_COLOR[event.event_type] ?? "bg-slate-400",
                        )}
                      />
                      <span className="flex-1 truncate">
                        {EVENT_LABEL[event.event_type] ?? event.event_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <footer className="mt-auto flex flex-wrap gap-2 border-t border-border bg-card/95 px-5 py-4">
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmBlock(true)}
              >
                <Ban className="mr-1.5 size-3.5" /> Block IP
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void sendToHoneypot()}
                className="border-orange-500/50 text-orange-400 hover:text-orange-300"
              >
                <Bug className="mr-1.5 size-3.5" /> Send to honeypot
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void whitelist()}
                className="border-emerald-500/50 text-emerald-400 hover:text-emerald-300"
              >
                <ShieldCheck className="mr-1.5 size-3.5" /> Whitelist
              </Button>
            </footer>
          </motion.aside>

          <ConfirmDialog
            open={confirmBlock}
            onOpenChange={setConfirmBlock}
            title={`Block ${visitor.ip_address}?`}
            description="This IP will be denied access immediately. You can lift the block later from Threat Intel."
            confirmLabel="Block IP"
            destructive
            onConfirm={blockIp}
          />
        </>
      ) : null}
    </AnimatePresence>
  );
}
