import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/primitives/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function LandingHero() {
  return (
    <section className="bg-gradient-hero border-b border-border">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 text-primary" />
          Deception-based storage security
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Secure cloud storage with an <span className="text-primary">AI deception layer</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          IntelliTrap stores your files with encryption, quotas and granular sharing — while
          silently profiling every session and diverting attackers into a monitored honeypot.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Create an account
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
