import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/primitives/page-header";
import { EmptyState } from "@/components/primitives/empty-state";
import { RoleGuard } from "@/components/auth/role-guard";

const title = "Security console";
const description = "Admin-only threat monitoring and deception analytics for IntelliTrap.";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <RoleGuard role="admin">
      <PageHeader title="Security console" description="Admin access confirmed." />
      <EmptyState
        icon={ShieldAlert}
        title="No threat data yet"
        description="Honeypot telemetry and AI reports arrive in later phases."
      />
    </RoleGuard>
  );
}
