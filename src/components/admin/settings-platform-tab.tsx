import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toIST } from "@/lib/share/format";
import { useAuth } from "@/lib/auth/auth-context";
import { PLATFORM_SETTING_KEYS, upsertPlatformSettings, type PlatformSetting } from "@/lib/admin/admin-data";

const TOGGLES = [
  { key: PLATFORM_SETTING_KEYS.registrationEnabled, label: "Registration Enabled" },
  { key: PLATFORM_SETTING_KEYS.honeypotEnabled, label: "Honeypot Enabled" },
  { key: PLATFORM_SETTING_KEYS.autoBlockEnabled, label: "Auto-Block Enabled" },
  { key: PLATFORM_SETTING_KEYS.maintenanceMode, label: "Maintenance Mode" },
] as const;

export function SettingsPlatformTab({ settings }: { settings: PlatformSetting[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const toggle of TOGGLES) {
      const row = settings.find((setting) => setting.key === toggle.key);
      next[toggle.key] = row?.value === "true";
    }
    setValues(next);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPlatformSettings(
        TOGGLES.map((toggle) => ({ key: toggle.key, value: String(values[toggle.key] ?? false) })),
        user?.id ?? null,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      toast.success("Platform settings saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save settings"),
  });

  return (
    <div className="space-y-4">
      {values[PLATFORM_SETTING_KEYS.maintenanceMode] ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Maintenance mode is ON — regular users cannot access the platform.
        </div>
      ) : null}

      <div className="glass divide-y divide-border/40 rounded-xl">
        {TOGGLES.map((toggle) => {
          const row = settings.find((setting) => setting.key === toggle.key);
          return (
            <div key={toggle.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{toggle.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row ? `Last updated ${toIST(row.updated_at)}` : "Not yet configured"}
                </p>
              </div>
              <Switch
                checked={values[toggle.key] ?? false}
                onCheckedChange={(checked) =>
                  setValues((current) => ({ ...current, [toggle.key]: checked }))
                }
              />
            </div>
          );
        })}
      </div>

      <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save All
      </Button>
    </div>
  );
}
