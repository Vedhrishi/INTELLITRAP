import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { registerSchema, type RegisterValues } from "@/lib/auth/auth-schemas";
import { useAuth } from "@/lib/auth/auth-context";

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
  const terms = watch("terms");

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await signUp(values.email, values.password, values.fullName);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Account created. Welcome to IntelliTrap.");
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
        <PasswordStrength value={password} />
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
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Create account
      </Button>
    </form>
  );
}
