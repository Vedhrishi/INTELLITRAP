import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { forgotSchema, type ForgotValues } from "@/lib/auth/auth-schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { useResendCooldown } from "@/lib/auth/use-resend-cooldown";
import { reportAuthFailure } from "@/lib/auth/report-auth-failure";

const title = "Reset your IntelliTrap password";
const description = "Request a password reset link for your IntelliTrap account.";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const cooldown = useResendCooldown("reset");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  // Neutral response either way — never reveal whether an account exists.
  const onSubmit = handleSubmit(async (values) => {
    const { error, reason, retryAfter } = await resetPassword(values.email);
    if (error && reason !== "invalid_credentials") {
      reportAuthFailure({ reason, flow: "reset", email: values.email });
    }
    cooldown.start(reason === "rate_limited" ? retryAfter : 60);
    setSent(values.email);
  });

  const resend = async () => {
    if (!sent || cooldown.active || resending) return;
    setResending(true);
    const { reason, retryAfter } = await resetPassword(sent);
    setResending(false);
    cooldown.start(reason === "rate_limited" ? retryAfter : 60);
  };

  return (
    <AuthLayout
      title="Forgot your password?"
      description="We'll email you a link to choose a new one."
      footer={
        <p className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-sm text-muted-foreground">
              If an account exists for{" "}
              <span className="font-mono-data text-foreground">{sent}</span>, a password reset link
              is on its way. Check your inbox and spam folder.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void resend()}
            disabled={cooldown.active || resending}
          >
            {resending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {cooldown.active ? `Resend available in ${cooldown.label}` : "Resend reset link"}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
