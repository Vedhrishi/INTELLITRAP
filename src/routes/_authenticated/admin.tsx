import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/auth/role-guard";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  return (
    <RoleGuard role="admin">
      <Outlet />
    </RoleGuard>
  );
}
