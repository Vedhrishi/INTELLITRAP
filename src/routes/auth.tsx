import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/primitives/logo";

const title = "Sign in or create an account — IntelliTrap";
const description = "Access your encrypted IntelliTrap workspace or register a new account.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="bg-gradient-hero flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <Link to="/" aria-label="IntelliTrap home">
        <Logo />
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Authentication is wired up in the next build phase (Lovable Cloud auth).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                Register
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-4 text-sm text-muted-foreground">
              Email + password sign-in arrives with Phase 2.
            </TabsContent>
            <TabsContent value="register" className="pt-4 text-sm text-muted-foreground">
              Account creation arrives with Phase 2.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
