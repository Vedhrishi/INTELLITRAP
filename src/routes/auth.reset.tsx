import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { AuthLayout } from "@/components/auth/auth-layout";
import {
  commonPasswordIssue,
  passwordScore,
  resetSchema,
  type ResetValues,
} from "@/lib/auth/auth-schemas";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { reportAuthFailure } from "@/lib/auth/report-auth-failure";
import { supabase } from "@/integrations/supabase/client";

const title = "Choose a new IntelliTrap password";
const description = "Set a new password for your IntelliTrap account.";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [linkValid, setLinkValid] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password") ?? "";
  const confirmPassword = watch("confirmPassword") ?? "";

  // A recovery link creates a session. Without one there is nothing to update,
  // so say the link expired instead of failing on submit.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setLinkValid(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  const strengthOk =
    password.length >= 8 &&
    passwordScore(password) >= 3 &&
    !commonPasswordIssue(password) &&
    password === confirmPassword;

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      const described = describeAuthError(error.message);
      if (described.field === "password")
        setError("password", { type: "server", message: described.message });
      toast.error(described.message);
      reportAuthFailure({ reason: described.reason, flow: "update_password" });
      return;
    }
    setDone(true);
    toast.success("Password updated. You're signed in.");
    setTimeout(() => void navigate({ to: "/app", replace: true }), 1200);
  });

  if (linkValid === false) {
    return (
      <AuthLayout
        title="Reset link expired"
        description="Password reset links can only be used once and expire after a short while."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm text-muted-foreground">
              This link has expired or was already used. Request a new one and open the newest email.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/auth/forgot">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" description="Your new password is active.">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">
            Password changed successfully. Taking you to your workspace…
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password you haven't used before."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <PasswordStrength value={password} showIssue={!errors.password} />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !strengthOk || linkValid === null}
        >
          {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
