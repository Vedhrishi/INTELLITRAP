/** Maps backend auth errors to human messages. Raw errors are never shown. */

/** Which form field an auth failure belongs to, so it can be shown inline. */
export type AuthErrorField = "email" | "password" | null;

/**
 * Machine-readable reason, safe to store and aggregate. Deliberately coarse so
 * nothing sensitive (the attempted password, tokens, raw provider text) leaks
 * into the admin-visible failure log.
 */
export type AuthFailureReason =
  | "invalid_credentials"
  | "already_registered"
  | "email_not_confirmed"
  | "invalid_email"
  | "weak_password"
  | "signup_disabled"
  | "rate_limited"
  | "expired_link"
  | "network"
  | "other";

export function humanAuthError(message: string | undefined): string {
  return describeAuthError(message).message;
}

/** Cooldown in seconds the backend asked for, when it named one. */
export function backendCooldownSeconds(message: string | undefined): number | null {
  const match = (message ?? "").toLowerCase().match(/after (\d+) seconds?/);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Human message plus the field it should be attached to. The backend wording is
 * matched loosely because Supabase phrases the same condition several ways
 * (e.g. a breached password is reported as "known to be weak", not "pwned").
 */
export function describeAuthError(message: string | undefined): {
  message: string;
  field: AuthErrorField;
} {
  const raw = (message ?? "").toLowerCase();

  if (raw.includes("invalid login credentials") || raw.includes("invalid credentials"))
    return { message: "Email or password is incorrect.", field: "password" };

  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return {
      message: "An account with this email already exists. Try signing in instead.",
      field: "email",
    };

  if (raw.includes("email not confirmed"))
    return {
      message: "Please confirm your email address first — check your inbox for the link.",
      field: "email",
    };

  if (raw.includes("invalid email") || raw.includes("email address") && raw.includes("invalid"))
    return { message: "That email address isn't valid. Check it and try again.", field: "email" };

  if (raw.includes("password should be at least") || raw.includes("password is too short"))
    return { message: "That password is too short. Use at least 8 characters.", field: "password" };

  // HIBP / breach checking. Supabase returns "Password is known to be weak and
  // easy to guess, please choose a different one." — no mention of "pwned".
  if (
    raw.includes("pwned") ||
    raw.includes("compromised") ||
    raw.includes("known to be weak") ||
    raw.includes("easy to guess") ||
    (raw.includes("weak") && raw.includes("password"))
  )
    return {
      message:
        "That password appears in known data breaches. Pick something longer and less common.",
      field: "password",
    };

  if (raw.includes("signups not allowed") || raw.includes("signup is disabled"))
    return { message: "New registrations are currently closed on this workspace.", field: null };

  // "For security purposes, you can only request this after 46 seconds."
  const cooldown = raw.match(/after (\d+) seconds?/);
  if (cooldown)
    return {
      message: `Please wait ${cooldown[1]} seconds before trying again.`,
      field: null,
    };

  if (raw.includes("email rate limit") || raw.includes("over_email_send_rate_limit"))
    return {
      message: "Too many emails sent from this workspace. Please try again in an hour.",
      field: null,
    };

  if (raw.includes("rate limit") || raw.includes("too many"))
    return { message: "Too many attempts. Please wait a moment and try again.", field: null };

  if (raw.includes("expired") || raw.includes("already been used") || raw.includes("invalid token"))
    return {
      message: "That link has expired or was already used. Request a new one.",
      field: null,
    };

  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to send"))
    return {
      message: "We couldn't reach the server. Check your connection and try again.",
      field: null,
    };

  return { message: "Something went wrong. Please try again.", field: null };
}
