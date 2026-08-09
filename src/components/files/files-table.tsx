import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/primitives/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize, toIST } from "@/lib/share/format";
import { FileTypeIcon } from "./file-type-icon";
import { ShareInfoDialog } from "./share-info-dialog";
import { DeleteFileDialog } from "./delete-file-dialog";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { computeFileStatus, statusBadgeClass, type FileRow } from "./types";

export function FilesTable({
  files,
  userId,
  userSecretCode,
  onReupload,
}: {
  files: FileRow[];
  userId: string;
  userSecretCode: string | null;
  onReupload: () => void;
}) {
  const queryClient = useQueryClient();
  const [shareFile, setShareFile] = useState<FileRow | null>(null);
  const [revokeFile, setRevokeFile] = useState<FileRow | null>(null);
  const [deleteFile, setDeleteFile] = useState<FileRow | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["secure-files", userId] });
  };

  const handleDownload = async (file: FileRow) => {
    const { data, error } = await supabase.storage.from("user-files").createSignedUrl(file.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = data.signedUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleRevoke = async (file: FileRow) => {
    const { error } = await supabase.from("files").update({ share_revoked: true }).eq("id", file.id);
    if (error) {
      toast.error("Could not revoke sharing");
      return;
    }
    toast.success("Sharing revoked");
    invalidate();
  };

  const handleDelete = async (file: FileRow) => {
    const { error: storageError } = await supabase.storage.from("user-files").remove([file.storage_path]);
    if (storageError && import.meta.env.DEV) console.warn(storageError.message);
    const { error } = await supabase.from("files").delete().eq("id", file.id);
    if (error) {
      toast.error("Could not delete file");
      return;
    }
    toast.success("File deleted");
    setDeleteFile(null);
    invalidate();
  };

  if (files.length === 0) {
    return <EmptyState title="No files yet" description="Upload your first file to get started." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#334155]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#334155] hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Downloads</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const status = computeFileStatus(file);
            return (
              <TableRow key={file.id} className="border-[#334155]">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileTypeIcon mimeType={file.mime_type} name={file.name} />
                    <span className="max-w-[220px] truncate font-semibold text-slate-100">{file.name}</span>
                    {file.is_shared ? <span title="Secret-shared">🔑</span> : null}
                  </div>
                </TableCell>
                <TableCell className="text-[#94a3b8]">{formatFileSize(file.size_bytes)}</TableCell>
                <TableCell className="whitespace-nowrap text-[#94a3b8]">{toIST(file.created_at)}</TableCell>
                <TableCell className="text-[#94a3b8]">{file.download_count}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass[status]}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void handleDownload(file)}>Download</DropdownMenuItem>
                      {file.is_shared ? (
                        <DropdownMenuItem onClick={() => setShareFile(file)}>Share Info</DropdownMenuItem>
                      ) : null}
                      {file.is_shared && !file.share_revoked ? (
                        <DropdownMenuItem onClick={() => setRevokeFile(file)}>Revoke</DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className="text-red-400" onClick={() => setDeleteFile(file)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ShareInfoDialog
        file={shareFile}
        userSecretCode={userSecretCode}
        open={shareFile !== null}
        onOpenChange={(open) => !open && setShareFile(null)}
        onRevokeAndReupload={(file) => {
          setShareFile(null);
          void handleRevoke(file);
          onReupload();
        }}
      />

      <ConfirmDialog
        open={revokeFile !== null}
        onOpenChange={(open) => !open && setRevokeFile(null)}
        title="Revoke sharing?"
        description={`This will disable secret sharing for "${revokeFile?.name ?? ""}".`}
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revokeFile) void handleRevoke(revokeFile);
          setRevokeFile(null);
        }}
      />

      <DeleteFileDialog
        file={deleteFile}
        open={deleteFile !== null}
        onOpenChange={(open) => !open && setDeleteFile(null)}
        onConfirm={(file) => void handleDelete(file)}
      />
    </div>
  );
}
