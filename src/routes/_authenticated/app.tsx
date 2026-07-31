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
  const { profile, user } = useAuth();

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? profile?.email ?? user?.email ?? "there"}`}
        description="Authentication is live. File storage arrives in the next phase."
      />
      <EmptyState
        icon={FolderOpen}
        title="No files yet"
        description="Encrypted uploads, sharing and the deception layer land in Phase 3."
      />
    </>
  );
}
