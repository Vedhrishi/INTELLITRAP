import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toIST } from "@/lib/share/format";
import { formatFileSize } from "@/lib/share/format";
import type { Profile } from "@/lib/admin/admin-data";

export function UserDetailDrawer({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={Boolean(profile)} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg px-4 pb-8">
          <DrawerHeader>
            <DrawerTitle>{profile?.full_name ?? "User details"}</DrawerTitle>
          </DrawerHeader>
          {profile ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right">{profile.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="text-right capitalize">{profile.role}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right capitalize">{profile.status}</dd>
              <dt className="text-muted-foreground">Secret code</dt>
              <dd className="text-right font-mono">{profile.user_secret_code ?? "—"}</dd>
              <dt className="text-muted-foreground">Storage used</dt>
              <dd className="text-right">
                {formatFileSize(profile.storage_used)} / {formatFileSize(profile.storage_quota)}
              </dd>
              <dt className="text-muted-foreground">Risk score</dt>
              <dd className="text-right">{profile.risk_score}</dd>
              <dt className="text-muted-foreground">Login count</dt>
              <dd className="text-right">{profile.login_count}</dd>
              <dt className="text-muted-foreground">Last login</dt>
              <dd className="text-right">{toIST(profile.last_login)}</dd>
              <dt className="text-muted-foreground">Last login IP</dt>
              <dd className="text-right font-mono">{profile.last_login_ip ?? "—"}</dd>
              <dt className="text-muted-foreground">Account created</dt>
              <dd className="text-right">{toIST(profile.created_at)}</dd>
            </dl>
          ) : null}
          <DrawerClose asChild>
            <Button variant="outline" className="mt-6 w-full">
              Close
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
