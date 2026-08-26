import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { AuthResult, SignUpResult } from "@/lib/auth/auth-context";

const signIn = vi.fn<(email: string, password: string) => Promise<AuthResult>>();
const signUp = vi.fn<(email: string, password: string, name: string) => Promise<SignUpResult>>();
const resendConfirmation = vi.fn<(email: string) => Promise<AuthResult>>();
const reportAuthFailure = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ signIn, signUp, resendConfirmation }),
}));
vi.mock("@/lib/auth/report-auth-failure", () => ({
  reportAuthFailure: (...args: unknown[]) => reportAuthFailure(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const { LoginForm } = await import("@/components/auth/login-form");
const { RegisterForm } = await import("@/components/auth/register-form");

const ok: AuthResult = { error: null, field: null, reason: "other" };

beforeEach(() => {
  signIn.mockResolvedValue(ok);
  signUp.mockResolvedValue({ ...ok, needsEmailConfirmation: false });
  resendConfirmation.mockResolvedValue(ok);
  window.sessionStorage.clear();
});

describe("login form", () => {
  it("validates the email locally before calling the backend", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "Whatever1!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("renders a wrong-password failure on the password field and reports it", async () => {
    signIn.mockResolvedValue({
      error: "Email or password is incorrect.",
      field: "password",
      reason: "invalid_credentials",
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Email"), "analyst@intellitrap.dev");
    await user.type(screen.getByLabelText("Password"), "WrongPass1!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(reportAuthFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "invalid_credentials", flow: "login" }),
      ),
    );
  });

  it("signs in successfully with valid credentials", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Email"), "analyst@intellitrap.dev");
    await user.type(screen.getByLabelText("Password"), "Str0ng-Vault#42");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(reportAuthFailure).not.toHaveBeenCalled();
  });
});

async function fillRegister(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  email = "new.user@intellitrap.dev",
) {
  await user.type(screen.getByLabelText("Full name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Confirm password"), password);
  await user.click(screen.getByLabelText(/I agree to the terms/));
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("register form", () => {
  it("rejects a breached/common password before hitting the backend", async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);

    await fillRegister(user, "Password123!");

    expect(await screen.findByText(/Too common/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password that reuses the email name", async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);

    await fillRegister(user, "Vishnu-Kumar9!", "vishnu@intellitrap.dev");

    expect(await screen.findByText(/Don't reuse your email name/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows a mismatch error on the confirm field", async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Full name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "new.user@intellitrap.dev");
    await user.type(screen.getByLabelText("Password"), "Quiet-Harbor#71");
    await user.type(screen.getByLabelText("Confirm password"), "Quiet-Harbor#72");
    await user.click(screen.getByLabelText(/I agree to the terms/));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("surfaces a server-side breach rejection on the password field", async () => {
    signUp.mockResolvedValue({
      error: "That password appears in known data breaches. Pick something longer and less common.",
      field: "password",
      reason: "weak_password",
      needsEmailConfirmation: false,
    });
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);

    await fillRegister(user, "Quiet-Harbor#71");

    expect(await screen.findByText(/appears in known data breaches/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(reportAuthFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "weak_password", flow: "register" }),
      ),
    );
  });

  it("shows the confirm-email state with a resend countdown instead of navigating", async () => {
    signUp.mockResolvedValue({ ...ok, needsEmailConfirmation: true });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={onSuccess} />);

    await fillRegister(user, "Quiet-Harbor#71");

    expect(await screen.findByText("Confirm your email")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    const resend = screen.getByRole("button", { name: /Resend in/ });
    expect(resend).toBeDisabled();
  });

  it("continues into the app when a session is returned", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={onSuccess} />);

    await fillRegister(user, "Quiet-Harbor#71");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
