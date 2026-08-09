import { AlertTriangle } from "lucide-react";
import { formatFileSize } from "@/lib/share/format";
import { FileTypeIcon } from "./file-type-icon";
import { USER_MAX_FILES, USER_STORAGE_QUOTA, usedBytes, type FileRow } from "./types";

function barClass(percent: number): string {
  if (percent < 50) return "bg-blue-500";
  if (percent < 80) return "bg-amber-500";
  return "bg-red-500";
}

export function StorageTab({ files }: { files: FileRow[] }) {
  const used = usedBytes(files);
  const percent = Math.min(100, Math.round((used / USER_STORAGE_QUOTA) * 100));
  const filePercent = Math.min(100, Math.round((files.length / USER_MAX_FILES) * 100));
  const almostFull = used > 0.9 * USER_STORAGE_QUOTA;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-100">Storage used</p>
          <p className="text-sm text-[#94a3b8]">
            {formatFileSize(used)} / {formatFileSize(USER_STORAGE_QUOTA)}
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0f172a]">
          <div
            className={`h-full rounded-full transition-all ${barClass(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {almostFull ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">
              Storage almost full. Delete old files to free space.
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-100">Files</p>
          <p className="text-sm text-[#94a3b8]">
            {files.length} / {USER_MAX_FILES}
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0f172a]">
          <div
            className={`h-full rounded-full transition-all ${barClass(filePercent)}`}
            style={{ width: `${filePercent}%` }}
          />
        </div>
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
