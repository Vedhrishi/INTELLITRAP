import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const IST = "Asia/Kolkata";

/** Human file size, e.g. 1.4 MB. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Render an instant in Indian Standard Time. */
export function toIST(
  value: string | number | Date | null | undefined,
  pattern = "dd MMM yyyy, HH:mm",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatInTimeZone(date, IST, pattern)} IST`;
}

export function toISTTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatInTimeZone(date, IST, "HH:mm:ss");
}

/** Start of "today" in IST, as an ISO instant. */
export function startOfTodayIST(): string {
  const now = new Date();
  const istDay = formatInTimeZone(now, IST, "yyyy-MM-dd");
  return new Date(`${istDay}T00:00:00+05:30`).toISOString();
}

export function formatLocalDate(value: Date): string {
  return format(value, "dd MMM yyyy");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8-character, human-readable sharing code (no ambiguous glyphs). */
export function generateSecretCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/**
 * SHA-256 hex digest — used for file passwords and demo OTP comparison.
 * Salted identically to hashSharePassword() in tracking.server.ts so uploaded
 * hashes match server-side verification.
 */
export async function hashPassword(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${value}intellitrap-salt-2024`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type PasswordStrength = { segments: 1 | 2 | 3 | 4; label: string; className: string };

export function passwordStrength(value: string): PasswordStrength {
  const length = value.trim().length;
  if (length <= 4) return { segments: 1, label: "Weak", className: "bg-red-500" };
  if (length <= 8) return { segments: 2, label: "Fair", className: "bg-orange-500" };
  if (length <= 12) return { segments: 3, label: "Good", className: "bg-yellow-500" };
  return { segments: 4, label: "Strong", className: "bg-green-500" };
}

/** Absolute app origin, safe during SSR. */
export function appOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}
