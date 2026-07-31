import { useRef, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full" aria-busy="true" aria-label="Loading your workspace">
      <div className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-4 md:block">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="size-8" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-6 p-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Capture the intended destination once: re-reading the live location while
  // the redirect is in flight nests /auth?redirect=... inside itself forever.
  const intended = useRef<string | null>(null);
  if (!intended.current && !pathname.startsWith("/auth")) intended.current = pathname;

  if (loading) return <ShellSkeleton />;
  if (!user) return <Navigate to="/auth" search={{ redirect: intended.current ?? "/app" }} replace />;
  return <>{children}</>;
}
