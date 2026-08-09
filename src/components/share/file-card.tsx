import { FileText, FileImage, FileArchive, FileSpreadsheet, FileVideo, File as FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/share/format";

export function fileIconFor(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return FileArchive;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return FileSpreadsheet;
  if (mimeType.includes("pdf") || mimeType.includes("text") || mimeType.includes("document"))
    return FileText;
  return FileIcon;
}

export function FileCard({
  name,
  size,
  type,
  uploadedLabel,
  oneTime,
  children,
}: {
  name: string;
  size: number;
  type: string;
  uploadedLabel?: string;
  oneTime?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = fileIconFor(type);
  return (
    <div className="rounded-xl border border-[#334155] bg-[#0f172a] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-[#3b82f6]">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
            <span>{formatFileSize(size)}</span>
            <span className="rounded-full bg-[#334155] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#94a3b8]">
              {type.split("/")[1] ?? type}
            </span>
          </div>
          {uploadedLabel ? <p className="mt-1 text-xs text-[#64748b]">{uploadedLabel}</p> : null}
        </div>
      </div>
      {oneTime ? (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          ⚠ This is a one-time download. The file will be removed after this download.
        </p>
      ) : null}
      {children}
    </div>
  );
}
