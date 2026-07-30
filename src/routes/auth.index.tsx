import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { useAuth } from "@/lib/auth/auth-context";

const title = "Sign in to IntelliTrap";
const description = "Access your encrypted workspace or create a new IntelliTrap account.";

const searchSchema = z.object({
  redirect: z.string().startsWith("/").optional(),
});

export const Route = createFileRoute("/auth/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `${title} — Secure cloud storage` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const destination = redirect ?? "/app";

  useEffect(() => {
    if (!loading && user) void navigate({ to: destination, replace: true });
  }, [loading, user, destination, navigate]);

  const goToApp = () => {
    void navigate({ to: destination, replace: true });
  };

  return (
    <AuthLayout title="Welcome back" description="Secure cloud storage with an AI deception layer.">
      <Tabs defaultValue="login">
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="register" className="flex-1">
            Register
          </TabsTrigger>
        </TabsList>
        <TabsContent value="login" className="pt-5">
          <LoginForm onSuccess={goToApp} />
        </TabsContent>
        <TabsContent value="register" className="pt-5">
          <RegisterForm onSuccess={goToApp} />
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}
