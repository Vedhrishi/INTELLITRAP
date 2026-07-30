import { useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth-context";

function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu() {
  const { user, profile, roles, isAdmin } = useAuth();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) return null;

  const email = profile?.email ?? user.email ?? null;
  const displayName = profile?.full_name ?? email;
  const primaryRole = isAdmin ? "admin" : (roles[0] ?? "user");

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initialsFrom(profile?.full_name, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          <Badge variant="secondary" className="mt-1 gap-1">
            {primaryRole === "admin" ? (
              <ShieldCheck aria-hidden className="size-3" />
            ) : (
              <UserIcon aria-hidden className="size-3" />
            )}
            {primaryRole}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut aria-hidden className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
