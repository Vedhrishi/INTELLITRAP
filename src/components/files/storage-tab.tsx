import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/share/format";
import { FileTypeIcon } from "./file-type-icon";
import { USER_MAX_FILES, USER_STORAGE_QUOTA, usedBytes, type FileRow } from "./types";

export function StorageTab({ files }: { files: FileRow[] }) {
  const used = usedBytes(files);
  const percent = Math.min(100, Math.round((used / USER_STORAGE_QUOTA) * 100));
  const filePercent = Math.min(100, Math.round((files.length / USER_MAX_FILES) * 100));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-100">Storage used</p>
          <p className="text-sm text-[#94a3b8]">
            {formatFileSize(used)} / {formatFileSize(USER_STORAGE_QUOTA)}
          </p>
        </div>
        <Progress value={percent} className="mt-3 h-2" />
        <div className="mt-5 flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-100">Files</p>
          <p className="text-sm text-[#94a3b8]">
            {files.length} / {USER_MAX_FILES}
          </p>
        </div>
        <Progress value={filePercent} className="mt-3 h-2" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-100">Files</p>
        {files.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">No files uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-[#334155] rounded-lg border border-[#334155]">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 p-3">
                <FileTypeIcon mimeType={file.mime_type} name={file.name} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{file.name}</span>
                <span className="text-xs text-[#94a3b8]">{formatFileSize(file.size_bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
