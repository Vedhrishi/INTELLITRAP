import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toIST } from "@/lib/share/format";
import { REMOVAL_REASONS, removeUser, type Profile, type RemovalReason } from "@/lib/admin/admin-data";
import { useAuth } from "@/lib/auth/auth-context";

const CONFIRM_PHRASE = "CONFIRM REMOVE";

function initials(profile: Profile): string {
  const source = profile.full_name ?? profile.email ?? "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function RemoveUserDialog({
  target,
  onClose,
  onRemoved,
}: {
  target: Profile | null;
  onClose: () => void;
  onRemoved: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<RemovalReason>(REMOVAL_REASONS[0]);
  const [banIp, setBanIp] = useState(false);
  const [wipeFiles, setWipeFiles] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!target) return null;

  const canSubmit = confirmText === CONFIRM_PHRASE && !submitting;

  const handleClose = () => {
    setReason(REMOVAL_REASONS[0]);
    setBanIp(false);
    setWipeFiles(false);
    setConfirmText("");
    onClose();
  };

  const handleRemove = async () => {
    if (target.role === "admin") {
      toast.error("Admin accounts are protected");
      return;
    }
    setSubmitting(true);
    try {
      await removeUser({
        target,
        reason,
        banIp,
        wipeFiles,
        admin: { id: user?.id ?? null, email: user?.email ?? null },
      });
      toast.success("User removed successfully");
      onRemoved(target.id);
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-[#1e293b] p-8">
        <DialogHeader>
          <DialogTitle className="sr-only">Remove user</DialogTitle>
        </DialogHeader>

        {target.role === "admin" ? (
          <p className="text-sm text-red-400">Admin accounts are protected</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#3b82f6] text-lg font-semibold text-white">
                {initials(target)}
              </div>
              <p className="text-sm font-semibold">{target.full_name ?? "Unnamed user"}</p>
              <p className="text-xs text-muted-foreground">{target.email}</p>
              <p className="text-[11px] text-muted-foreground">
                Account created: {toIST(target.created_at)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Reason</label>
              <Select value={reason} onValueChange={(value) => setReason(value as RemovalReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMOVAL_REASONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={banIp} onCheckedChange={(value) => setBanIp(value === true)} />
                Permanently ban IP address
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={wipeFiles}
                  onCheckedChange={(value) => setWipeFiles(value === true)}
                />
                Delete all files (GDPR wipe)
              </label>
            </div>

            <div className="border-t border-border/60 pt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Type {CONFIRM_PHRASE} to proceed:
              </label>
              <Input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="mt-2 font-mono"
                placeholder={CONFIRM_PHRASE}
              />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              disabled={!canSubmit}
              onClick={() => void handleRemove()}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Remove User"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
