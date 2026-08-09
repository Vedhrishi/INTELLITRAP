import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { appOrigin } from "@/lib/share/format";

const DISMISS_KEY = "it_firstrun_dismissed";

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
    <div className="mb-6 flex gap-4 rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-5">
      <Radio className="mt-0.5 h-6 w-6 shrink-0 text-[#3b82f6]" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          Your threat detection system is live and waiting.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open your URL on your phone using mobile data. You will appear on the map as a real
          visitor with your ISP, city, and device profiled.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="truncate rounded bg-black/20 px-2 py-1 font-mono text-xs">{url}</code>
          <Button size="sm" variant="secondary" onClick={copyUrl}>
            Copy
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
