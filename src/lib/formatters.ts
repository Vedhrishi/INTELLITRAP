export { formatFileSize, toIST } from "./share/format";

/** Relative time, e.g. "5m ago". */
export function timeAgo(value: string | Date): string {
  try {
    const diff = Date.now() - new Date(value).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "unknown";
  }
}

/** Duration in seconds as "45s" or "2m 5s". */
export function formatSeconds(value: number): string {
  if (!value || value < 60) return `${value || 0}s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}
