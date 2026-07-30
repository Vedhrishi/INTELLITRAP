import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/primitives/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-gradient-hero flex min-h-screen flex-col px-4 py-8">
      <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link to="/" aria-label="IntelliTrap home" className="min-w-0">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <Card className="w-full max-w-md shadow-glow">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children}
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
