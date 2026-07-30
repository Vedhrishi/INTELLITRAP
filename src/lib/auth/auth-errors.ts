/** Maps backend auth errors to human messages. Raw errors are never shown. */
export function humanAuthError(message: string | undefined): string {
  const raw = (message ?? "").toLowerCase();

  if (raw.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return "An account with this email already exists.";
  if (raw.includes("email not confirmed")) return "Please confirm your email address first.";
  if (raw.includes("password should be at least"))
    return "That password is too short. Use at least 8 characters.";
  if (raw.includes("pwned") || raw.includes("compromised"))
    return "That password has appeared in a known data breach. Please choose another.";
  if (raw.includes("rate limit") || raw.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "We couldn't reach the server. Check your connection and try again.";

  return "Something went wrong. Please try again.";
}
