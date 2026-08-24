import { z } from "zod";

export const passwordRules = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  {
    id: "case",
    label: "Upper and lower case",
    test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  { id: "digit", label: "A number", test: (v: string) => /\d/.test(v) },
  { id: "symbol", label: "A symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export function passwordScore(value: string): number {
  return passwordRules.filter((rule) => rule.test(value)).length;
}

/**
 * Patterns the server-side breach check always rejects. Catching them locally
 * turns an opaque 422 into instant feedback while the user is still typing.
 */
const COMMON_PASSWORDS = [
  "password",
  "passw0rd",
  "qwerty",
  "qwertyui",
  "asdfgh",
  "zxcvbn",
  "letmein",
  "welcome",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "admin",
  "administrator",
  "root",
  "login",
  "abc123",
  "123456",
  "12345678",
  "87654321",
  "trustno1",
  "changeme",
  "secret",
  "master",
  "shadow",
  "superman",
  "starwars",
  "whatever",
  "intellitrap",
];

/**
 * Returns a reason when the password is predictable, or null when it looks fine.
 * `email` is optional so the same check works on the reset-password screen.
 */
export function commonPasswordIssue(value: string, email?: string): string | null {
  const password = value.trim();
  if (!password) return null;
  const lower = password.toLowerCase();

  if (/^\d+$/.test(password)) return "Numbers only — add letters and a symbol";
  if (/^(.)\1+$/.test(password)) return "That's a single repeated character";
  if (/^(?:abcdefgh|12345678|87654321|qwertyui)/.test(lower))
    return "That's a keyboard or counting sequence";

  for (const common of COMMON_PASSWORDS) {
    // Strip trailing digits/symbols so "Password123!" is still caught.
    const stem = lower.replace(/[^a-z]/g, "");
    if (stem === common || lower.startsWith(common))
      return "Too common — this appears in breach lists";
  }

  const prefix = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (prefix.length >= 4 && lower.includes(prefix))
    return "Don't reuse your email name in the password";

  return null;
}

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email").max(255),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72)
      .refine((value) => passwordScore(value) >= 3, "Add upper/lower case, a number or a symbol"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .superRefine((data, ctx) => {
    const issue = commonPasswordIssue(data.password, data.email);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: issue });
  });

export const forgotSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email").max(255),
});

export const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72)
      .refine((value) => passwordScore(value) >= 3, "Add upper/lower case, a number or a symbol"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
