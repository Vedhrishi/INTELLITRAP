import { FileIcon } from "@/components/primitives/file-icon";
import { cn } from "@/lib/utils";

function colorFor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "text-purple-400";
  if (mimeType.startsWith("video/")) return "text-pink-400";
  if (mimeType.startsWith("audio/")) return "text-amber-400";
  if (mimeType === "application/pdf") return "text-red-400";
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return "text-yellow-400";
  if (/sheet|csv|excel/.test(mimeType)) return "text-green-400";
  if (/json|javascript|typescript|xml|sql/.test(mimeType)) return "text-blue-400";
  return "text-[#94a3b8]";
}

export function FileTypeIcon({ mimeType, name, className }: { mimeType: string; name: string; className?: string }) {
  return <FileIcon mimeType={mimeType} name={name} className={cn(colorFor(mimeType), className)} />;
}
