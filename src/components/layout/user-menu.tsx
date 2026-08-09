import { useNavigate } from "@tanstack/react-router";
import { Copy, Crown, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  const secretCode = profile?.user_secret_code ?? null;

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(secretCode ?? "");
      toast.success("Secret code copied!");
    } catch {
      toast.error("Could not copy the code.");
    }
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {isAdmin ? <Crown aria-hidden className="size-3.5 shrink-0 text-amber-400" /> : null}
          </div>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>

          <p className="mb-1 mt-3 text-xs text-slate-500">Your Secret Code</p>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-sm tracking-wider text-blue-400">
              {secretCode ?? "—"}
            </span>
            <button
              type="button"
              aria-label="Copy secret code"
              onClick={(event) => {
                event.preventDefault();
                void copyCode();
              }}
              className="cursor-pointer text-slate-400 transition-colors hover:text-white"
            >
              <Copy aria-hidden className="size-3.5" />
            </button>
          </div>

          <Badge variant="secondary" className="mt-3 gap-1">
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
