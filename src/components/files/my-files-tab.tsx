import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilesTable } from "./files-table";
import { UploadDialog } from "./upload-dialog";
import type { FileRow } from "./types";

export function MyFilesTab({
  files,
  userId,
  userSecretCode,
  onRefresh,
}: {
  files: FileRow[];
  userId: string;
  userSecretCode: string | null;
  onRefresh: () => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-2 size-4" />
          Upload
        </Button>
      </div>

      <FilesTable
        files={files}
        userId={userId}
        userSecretCode={userSecretCode}
        onReupload={() => setUploadOpen(true)}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userSecretCode={userSecretCode}
        existingFiles={files}
        onUploaded={onRefresh}
      />
    </div>
  );
}
