import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { registerSchema, type RegisterValues } from "@/lib/auth/auth-schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { reportAuthFailure } from "@/lib/auth/report-auth-failure";
import { useResendCooldown } from "@/lib/auth/use-resend-cooldown";

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useAuth();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false as true,
    },
  });

  const password = watch("password") ?? "";
  const email = watch("email") ?? "";
  const terms = watch("terms");
  const cooldown = useResendCooldown(`confirm:${awaitingConfirmation ?? ""}`);
  const [resending, setResending] = useState(false);

  const resendConfirmation = async () => {
    if (!awaitingConfirmation || cooldown.active || resending) return;
    setResending(true);
    const { error, reason, retryAfter } = await resendConfirmationEmail(awaitingConfirmation);
    setResending(false);
    if (error) {
      toast.error(error);
      cooldown.start(reason === "rate_limited" ? retryAfter : 30);
      return;
    }
    toast.success("Confirmation email sent again.");
    cooldown.start();
  };

  const onSubmit = handleSubmit(async (values) => {
    const { error, field, reason, retryAfter, needsEmailConfirmation } = await signUp(
      values.email,
      values.password,
      values.fullName,
    );
    if (error) {
      if (field) setError(field, { type: "server", message: error });
      toast.error(error);
      reportAuthFailure({ reason, flow: "register", email: values.email });
      if (reason === "rate_limited") cooldown.start(retryAfter);
      return;
    }
    // No session means email confirmation is required — staying put beats
    // navigating into the app and bouncing straight back to sign-in.
    if (needsEmailConfirmation) {
      setAwaitingConfirmation(values.email);
      // The confirmation email just went out — hold resends for a minute.
      cooldown.start();
      toast.success("Check your email to confirm your account.");
      return;
    }
    toast.success("Account created. Welcome to IntelliTrap.");
    onSuccess();
  });

  if (awaitingConfirmation) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Confirm your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-mono-data text-foreground">{awaitingConfirmation}</span>. Open it
            to finish creating your account, then sign in.
          </p>
        </div>
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => void resendConfirmation()}
            disabled={cooldown.active || resending}
          >
            {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {cooldown.active ? `Resend in ${cooldown.label}` : "Resend confirmation email"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAwaitingConfirmation(null)}
          >
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <fieldset disabled={isSubmitting} className="space-y-4 border-0 p-0">
      <div className="space-y-2">
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          aria-invalid={Boolean(errors.fullName)}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        <PasswordStrength value={password} email={email} showIssue={!errors.password} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-confirm">Confirm password</Label>
        <PasswordInput
          id="register-confirm"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="register-terms"
          checked={Boolean(terms)}
          onCheckedChange={(checked) =>
            setValue("terms", (checked === true) as true, { shouldValidate: true })
          }
        />
        <Label htmlFor="register-terms" className="text-sm font-normal text-muted-foreground">
          I agree to the terms of service and acceptable-use policy.
        </Label>
      </div>
      {errors.terms ? <p className="text-xs text-destructive">{errors.terms.message}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      </fieldset>
    </form>
  );
}
