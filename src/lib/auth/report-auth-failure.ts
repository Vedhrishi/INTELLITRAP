import { logAuthFailure } from "./auth-failures.functions";
import { maskEmail, type AuthFailureReason } from "./auth-errors";

/**
 * Fire-and-forget failure report. Never throws and never blocks the form: the
 * user's error message must appear even when telemetry is unavailable.
 */
export function reportAuthFailure(input: {
  reason: AuthFailureReason;
  flow: "login" | "register" | "reset" | "update_password";
  email?: string | null;
}): void {
  const timezone =
    typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? null) : null;

  void logAuthFailure({
    data: {
      reason: input.reason,
      flow: input.flow,
      maskedEmail: maskEmail(input.email),
      timezone,
    },
  }).catch(() => undefined);
}
