import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { appOrigin } from "@/lib/share/format";

const DISMISS_KEY = "it_banner_dismissed_v2";

/** One-time nudge encouraging the owner to open their tracked URL on a phone. */
export function FirstRunBanner({ visible = true }: { visible?: boolean }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!visible || dismissed) return null;

  const url = appOrigin();

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const copyUrl = () => {
    void navigator.clipboard.writeText(url).then(() => toast.success("URL copied"));
  };

  return (
    <div className="relative mb-6 rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 h-6 w-6 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex gap-4">
          <Radio className="mt-0.5 size-5 shrink-0 animate-pulse text-[#3b82f6]" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              Your threat detection system is armed
            </p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Every person who opens your URL appears on the map instantly with their real IP, ISP,
              city, and device fingerprint.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm text-[#94a3b8]">Share this URL to start tracking:</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="truncate rounded bg-[#0f172a] px-3 py-2 font-mono text-xs">{url}</code>
            <Button size="sm" variant="secondary" onClick={copyUrl}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-[#64748b]">For your presentation:</p>
          <p className="text-xs text-[#64748b]">
            Ask a panel member to open the URL on their phone using mobile data. Their dot appears
            within 5 seconds.
          </p>
          <p className="mt-1 text-xs text-[#64748b]">
            Press Ctrl+Shift+P to enable presentation mode
          </p>
        </div>
      </div>
    </div>
  );
}
