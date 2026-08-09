import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FileRow } from "./types";

export function DeleteFileDialog({
  file,
  open,
  onOpenChange,
  onConfirm,
}: {
  file: FileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: FileRow) => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setConfirmText("");
      }}
    >
      <AlertDialogContent className="border-[#334155] bg-[#0f172a] text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete file permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove &quot;{file?.name}&quot; from storage. This cannot be undone. Type
            DELETE to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Type DELETE"
          className="border-[#334155] bg-[#1e293b]"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={confirmText !== "DELETE" || !file}
            onClick={() => {
              if (file) onConfirm(file);
              setConfirmText("");
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
