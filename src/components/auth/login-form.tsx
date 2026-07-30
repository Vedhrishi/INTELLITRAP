import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";
import { loginSchema, type LoginValues } from "@/lib/auth/auth-schemas";
import { useAuth } from "@/lib/auth/auth-context";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await signIn(values.email, values.password);
    if (error) {
      toast.error(error);
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Label htmlFor="login-password">Password</Label>
          <Link to="/auth/forgot" className="shrink-0 text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
