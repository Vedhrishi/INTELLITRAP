import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/primitives/logo";

const steps = [
  { step: "01", title: "Observe", body: "Each request is scored against enabled detection rules." },
  { step: "02", title: "Score", body: "Risk accumulates per session: allow, challenge, trap or block." },
  { step: "03", title: "Divert", body: "At the trap threshold the session is silently served decoy data." },
  { step: "04", title: "Analyse", body: "Telemetry becomes an AI report with tactics and next actions." },
];

export function LandingHow() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight">How the trap works</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li key={item.step} className="rounded-lg border border-border bg-background p-5">
              <span className="font-mono-data text-xs text-primary">{item.step}</span>
              <p className="mt-2 font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-10 sm:px-6">
      <div className="min-w-0">
        <Logo />
        <p className="mt-2 text-sm text-muted-foreground">
          Application-layer deception. No packet inspection, no false promises.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/auth">Sign in</Link>
      </Button>
    </footer>
  );
}
