import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/share/format";
import { FileTypeIcon } from "./file-type-icon";
import type { FileRow } from "./types";

const MAX_STORAGE = 50 * 1024 * 1024;

export function StorageTab({ files }: { files: FileRow[] }) {
  const used = files.reduce((total, file) => total + file.size_bytes, 0);
  const percent = Math.min(100, Math.round((used / MAX_STORAGE) * 100));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-100">Storage used</p>
          <p className="text-sm text-[#94a3b8]">
            {formatFileSize(used)} / {formatFileSize(MAX_STORAGE)}
          </p>
        </div>
        <Progress value={percent} className="mt-3 h-2" />
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
