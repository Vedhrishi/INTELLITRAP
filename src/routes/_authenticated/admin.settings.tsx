import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { SettingsPlatformTab } from "@/components/admin/settings-platform-tab";
import { SettingsThresholdsTab } from "@/components/admin/settings-thresholds-tab";
import { SettingsIpRulesTab } from "@/components/admin/settings-ip-rules-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPlatformSettings } from "@/lib/admin/admin-data";

const title = "Platform settings";
const description = "Configure platform toggles, risk thresholds and IP rules.";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <RoleGuard role="admin">
      <AdminLayout>
        <AdminSettingsContent />
      </AdminLayout>
    </RoleGuard>
  );
}

function AdminSettingsContent() {
  const settings = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: fetchPlatformSettings,
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <Settings aria-hidden className="size-6 text-[#facc15]" />
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Platform behaviour and access rules</p>
        </div>
      </div>

      {settings.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Tabs defaultValue="platform">
          <TabsList>
            <TabsTrigger value="platform">Platform</TabsTrigger>
            <TabsTrigger value="thresholds">Risk Thresholds</TabsTrigger>
            <TabsTrigger value="ip-rules">IP Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="platform">
            <SettingsPlatformTab settings={settings.data ?? []} />
          </TabsContent>
          <TabsContent value="thresholds">
            <SettingsThresholdsTab settings={settings.data ?? []} />
          </TabsContent>
          <TabsContent value="ip-rules">
            <SettingsIpRulesTab />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
