import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { PLATFORM_SETTING_KEYS, upsertPlatformSettings, type PlatformSetting } from "@/lib/admin/admin-data";

function settingValue(settings: PlatformSetting[], key: string, fallback: number): number {
  const row = settings.find((setting) => setting.key === key);
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsThresholdsTab({ settings }: { settings: PlatformSetting[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [medium, setMedium] = useState(30);
  const [high, setHigh] = useState(60);
  const [critical, setCritical] = useState(80);

  useEffect(() => {
    setMedium(settingValue(settings, PLATFORM_SETTING_KEYS.thresholdMedium, 30));
    setHigh(settingValue(settings, PLATFORM_SETTING_KEYS.thresholdHigh, 60));
    setCritical(settingValue(settings, PLATFORM_SETTING_KEYS.thresholdCritical, 80));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPlatformSettings(
        [
          { key: PLATFORM_SETTING_KEYS.thresholdMedium, value: String(medium) },
          { key: PLATFORM_SETTING_KEYS.thresholdHigh, value: String(high) },
          { key: PLATFORM_SETTING_KEYS.thresholdCritical, value: String(critical) },
        ],
        user?.id ?? null,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      toast.success("Risk thresholds saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save thresholds"),
  });

  return (
    <div className="space-y-6">
      <div className="glass space-y-6 rounded-xl p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Medium threshold</span>
            <span className="font-mono text-amber-400">{medium}</span>
          </div>
          <Slider
            min={20}
            max={59}
            step={1}
            value={[medium]}
            onValueChange={([value]) => setMedium(value ?? medium)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">High threshold</span>
            <span className="font-mono text-orange-400">{high}</span>
          </div>
          <Slider
            min={40}
            max={79}
            step={1}
            value={[high]}
            onValueChange={([value]) => setHigh(value ?? high)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Critical threshold</span>
            <span className="font-mono text-red-400">{critical}</span>
          </div>
          <Slider
            min={60}
            max={95}
            step={1}
            value={[critical]}
            onValueChange={([value]) => setCritical(value ?? critical)}
          />
        </div>
      </div>

      <div className="glass space-y-2 rounded-xl p-4 text-sm">
        <p className="font-medium text-emerald-400">
          Score 0-{Math.max(medium - 1, 0)} → LOW → Access Granted
        </p>
        <p className="font-medium text-amber-400">
          Score {medium}-{Math.max(high - 1, medium)} → MEDIUM → CAPTCHA
        </p>
        <p className="font-medium text-orange-400">
          Score {high}-{Math.max(critical - 1, high)} → HIGH → Honeypot
        </p>
        <p className="font-medium text-red-400">Score {critical}-100 → CRITICAL → Auto-Blocked</p>
      </div>

      <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save Thresholds
      </Button>
    </div>
  );
}
