import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/primitives/page-header";
import { EmptyState } from "@/components/primitives/empty-state";
import { StatCard } from "@/components/primitives/stat-card";
import { Progress } from "@/components/ui/progress";
import { FolderOpen, HardDrive } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { DEFAULT_STORAGE_QUOTA_BYTES, formatBytes } from "@/config/security";


const title = "Your workspace";
const description = "Your encrypted files, shares and activity in IntelliTrap.";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { profile, user, loading } = useAuth();

  const used = profile?.storage_used ?? 0;
  const quota = profile?.storage_quota ?? DEFAULT_STORAGE_QUOTA_BYTES;
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? profile?.email ?? user?.email ?? "there"}`}
        description="Your account is secured and the data layer is live. Uploads arrive next."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Storage used"
          value={`${formatBytes(used)} of ${formatBytes(quota)}`}
          icon={HardDrive}
          loading={loading}
          hint={`${percent.toFixed(0)}% of your quota`}
          sparkline={<Progress value={percent} className="mt-3 h-2 w-24" />}
        />
      </div>
      <EmptyState
        icon={FolderOpen}
        title="No files yet"
        description="Encrypted uploads, folders and sharing arrive in the next phase."
      />
    </>
  );
}

