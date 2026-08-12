import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, type AppRole } from "@/lib/auth/auth-context";

/**
 * UX-only guard. The real security boundary is row-level security in the
 * database plus has_role() checks on the server.
 */
export function RoleGuard({ role, children }: { role: AppRole; children: ReactNode }) {
  const { roles, loading, rolesLoading, user } = useAuth();
  const navigate = useNavigate();
  const allowed = roles.includes(role);
  const resolving = loading || rolesLoading;

  useEffect(() => {
    if (resolving || !user || allowed) return;
    toast.error("You don't have access to the security console.");
    void navigate({ to: "/app", replace: true });
  }, [resolving, user, allowed, navigate]);

  if (resolving || !allowed) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
