import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toIST } from "@/lib/share/format";
import { fetchProfilesPage, setProfileStatus, type Profile } from "@/lib/admin/admin-data";
import { cn } from "@/lib/utils";
import { UserDetailDrawer } from "@/components/admin/user-detail-drawer";
import { RemoveUserDialog } from "@/components/admin/remove-user-dialog";

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-[#facc15]/20 text-[#facc15] border-[#facc15]/40",
  analyst: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  user: "bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/40",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  suspended: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  removed: "bg-red-500/15 text-red-400 border-red-500/30",
};

function initials(profile: Profile): string {
  const source = profile.full_name ?? profile.email ?? "?";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function UsersTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Profile | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin-profiles", page],
    queryFn: () => fetchProfilesPage(page, PAGE_SIZE),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setProfileStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("User status updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    },
  });

  const rows = (query.data?.rows ?? []).filter((row) => !removedIds.has(row.id));
  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  return (
    <section className="glass overflow-hidden rounded-xl">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">All users</h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {query.data?.count ?? 0} total
        </span>
      </header>

      {query.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Secret code</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last login</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((profile) => (
                  <motion.tr
                    key={profile.id}
                    layout
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-border/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-xs font-semibold text-white">
                          {initials(profile)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {profile.full_name ?? "Unnamed"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {profile.email ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", ROLE_BADGE[profile.role] ?? "")}
                      >
                        {profile.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {profile.user_secret_code ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", STATUS_BADGE[profile.status] ?? "")}
                      >
                        {profile.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {profile.last_login ? toIST(profile.last_login) : "Never"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDetail(profile)}>
                            View Details
                          </DropdownMenuItem>
                          {profile.status !== "suspended" ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                statusMutation.mutate({ id: profile.id, status: "suspended" })
                              }
                            >
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                statusMutation.mutate({ id: profile.id, status: "active" })
                              }
                            >
                              Restore
                            </DropdownMenuItem>
                          )}
                          {profile.role !== "admin" ? (
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400"
                              onSelect={() => setRemoveTarget(profile)}
                            >
                              Remove User
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs">
        <span className="text-muted-foreground">
          Page {page + 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </footer>

      <UserDetailDrawer profile={detail} onClose={() => setDetail(null)} />
      <RemoveUserDialog
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onRemoved={(id) => setRemovedIds((current) => new Set(current).add(id))}
      />
    </section>
  );
}
