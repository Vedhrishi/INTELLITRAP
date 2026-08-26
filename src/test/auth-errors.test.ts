import { describe, expect, it } from "vitest";
import {
  backendCooldownSeconds,
  describeAuthError,
  maskEmail,
} from "@/lib/auth/auth-errors";
import { commonPasswordIssue, passwordScore, registerSchema } from "@/lib/auth/auth-schemas";
import { formatCooldown } from "@/lib/auth/use-resend-cooldown";

describe("describeAuthError", () => {
  it("maps the backend's breach wording to a weak-password reason on the password field", () => {
    const result = describeAuthError(
      "Password is known to be weak and easy to guess, please choose a different one.",
    );
    expect(result.reason).toBe("weak_password");
    expect(result.field).toBe("password");
    expect(result.message).toMatch(/known data breaches/i);
  });

  it("maps invalid credentials", () => {
    expect(describeAuthError("Invalid login credentials").reason).toBe("invalid_credentials");
  });

  it("maps duplicate registration to the email field", () => {
    const result = describeAuthError("User already registered");
    expect(result.reason).toBe("already_registered");
    expect(result.field).toBe("email");
  });

  it("maps send-rate limiting and extracts the cooldown", () => {
    const message = "For security purposes, you can only request this after 46 seconds.";
    expect(describeAuthError(message).reason).toBe("rate_limited");
    expect(backendCooldownSeconds(message)).toBe(46);
  });

  it("falls back to a generic reason without leaking raw text", () => {
    const result = describeAuthError("pq: unexpected internal failure at 0xdeadbeef");
    expect(result.reason).toBe("other");
    expect(result.message).toBe("Something went wrong. Please try again.");
  });
});

describe("maskEmail", () => {
  it("keeps the domain and hides the local part", () => {
    expect(maskEmail("vishnu@gmail.com")).toBe("v••••u@gmail.com");
  });

  it("handles short local parts and empty input", () => {
    expect(maskEmail("ab@x.io")).toBe("a••@x.io");
    expect(maskEmail("")).toBeNull();
  });
});

describe("password validation", () => {
  it("flags common and predictable passwords", () => {
    expect(commonPasswordIssue("Password123!")).toMatch(/Too common/);
    expect(commonPasswordIssue("12345678")).toBeTruthy();
    expect(commonPasswordIssue("aaaaaaaa")).toMatch(/repeated character/);
    expect(commonPasswordIssue("Vishnu-Kumar9!", "vishnu@x.io")).toMatch(/email name/);
  });

  it("accepts a strong password", () => {
    expect(commonPasswordIssue("Quiet-Harbor#71")).toBeNull();
    expect(passwordScore("Quiet-Harbor#71")).toBe(4);
  });

  it("rejects weak passwords through the register schema", () => {
    const base = {
      fullName: "Ada Lovelace",
      email: "ada@intellitrap.dev",
      terms: true as const,
    };
    const weak = registerSchema.safeParse({
      ...base,
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(weak.success).toBe(false);

    const strong = registerSchema.safeParse({
      ...base,
      password: "Quiet-Harbor#71",
      confirmPassword: "Quiet-Harbor#71",
    });
    expect(strong.success).toBe(true);
  });
});

describe("formatCooldown", () => {
  it("renders m:ss", () => {
    expect(formatCooldown(60)).toBe("1:00");
    expect(formatCooldown(7)).toBe("0:07");
  });
});
