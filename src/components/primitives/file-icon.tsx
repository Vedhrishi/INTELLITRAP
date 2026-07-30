import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function pickIcon(mimeType: string, name: string): LucideIcon {
  if (mimeType === "folder") return Folder;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return FileArchive;
  if (/sheet|csv|excel/.test(mimeType) || /\.(csv|xlsx|xls)$/i.test(name)) return FileSpreadsheet;
  if (/json|javascript|typescript|xml|sql|x-sh/.test(mimeType) || /\.(sql|json|ts|tsx|js|sh)$/i.test(name))
    return FileCode;
  if (mimeType.startsWith("text/") || mimeType === "application/pdf") return FileText;
  return File;
}

export function FileIcon({
  mimeType = "application/octet-stream",
  name = "",
  className,
}: {
  mimeType?: string;
  name?: string;
  className?: string;
}) {
  const Icon = pickIcon(mimeType, name);
  return <Icon aria-hidden className={cn("size-5 shrink-0 text-muted-foreground", className)} />;
}
