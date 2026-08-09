import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { DashboardErrorBoundary } from "@/components/errors/dashboard-error-boundary";
import { SessionTimeout } from "@/components/session/session-timeout";
import { usePresentationMode } from "@/lib/presentation-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const presentationMode = usePresentationMode((state) => state.presentationMode);
  const toggle = usePresentationMode((state) => state.toggle);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    document.documentElement.classList.toggle("presentation-mode", presentationMode);
    return () => {
      document.documentElement.classList.remove("presentation-mode");
    };
  }, [presentationMode]);

  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardErrorBoundary>
          <Outlet />
        </DashboardErrorBoundary>
      </AppLayout>
      <SessionTimeout />
      {presentationMode ? (
        <div className="fixed right-4 top-4 z-50 rounded-full bg-[#3b82f6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
          Demo Mode
        </div>
      ) : null}
    </ProtectedRoute>
  );
}
