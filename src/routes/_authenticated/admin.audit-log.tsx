import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, ScrollText } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toIST, formatLocalDate } from "@/lib/share/format";
import { fetchAllAuditLog } from "@/lib/admin/admin-data";

const title = "Audit log";
const description = "Permanent, tamper-proof record of every administrative action.";

export const Route = createFileRoute("/_authenticated/admin/audit-log")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditLogPage,
});

function AdminAuditLogPage() {
  return (
    <RoleGuard role="admin">
      <AdminLayout>
        <AdminAuditLogContent />
      </AdminLayout>
    </RoleGuard>
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function AdminAuditLogContent() {
  const log = useQuery({ queryKey: ["admin-audit-log"], queryFn: fetchAllAuditLog });

  const exportCsv = () => {
    const rows = log.data ?? [];
    const header = ["time", "admin_email", "action_type", "target_type", "target_id", "details"];
    const lines = [header.join(",")];
    for (const entry of rows) {
      lines.push(
        [
          toIST(entry.created_at),
          entry.admin_email ?? "",
          entry.action_type,
          entry.target_type ?? "",
          entry.target_id ?? "",
          JSON.stringify(entry.details),
        ]
          .map((value) => csvEscape(String(value)))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `intellitrap-audit-${formatLocalDate(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText aria-hidden className="size-6 text-[#facc15]" />
          <div>
            <h1 className="text-xl font-semibold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">Every administrative action, forever.</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1.5 size-4" /> Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <AlertTriangle className="size-4 shrink-0" />
        This log is permanent and cannot be modified or deleted by anyone.
      </div>

      {log.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <AuditLogTable entries={log.data ?? []} />
      )}
    </>
  );
}
