import { Binary, Bot, Fingerprint, FolderLock, Radar, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: FolderLock,
    title: "Private by default",
    description:
      "Every file lives in a per-user storage prefix behind row-level security. No public buckets, ever.",
  },
  {
    icon: Fingerprint,
    title: "Session profiling",
    description:
      "Device fingerprint, geo, ASN and behaviour feed a live risk score on every sensitive action.",
  },
  {
    icon: Radar,
    title: "Detection rules",
    description:
      "Tunable regex and heuristic rules catch injection, traversal, scanners and mass-download bursts.",
  },
  {
    icon: Binary,
    title: "Silent diversion",
    description:
      "Sessions crossing the trap threshold land in a pixel-identical decoy vault. No warning, no tell.",
  },
  {
    icon: Bot,
    title: "AI analysis",
    description:
      "Evidence bundles are classified into tactics, indicators and recommended actions in plain English.",
  },
  {
    icon: ScrollText,
    title: "Immutable audit",
    description:
      "Every privileged action is append-only logged and exportable for incident review.",
  },
];

export function LandingFeatures() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight">
          Storage for your team. A trap for everyone else.
        </h2>
        <p className="mt-3 text-muted-foreground">
          One product, two experiences — a fast file workspace for people, and a monitored deception
          environment for intruders.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="bg-gradient-card transition-shadow duration-150 hover:shadow-glow"
          >
            <CardHeader>
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <feature.icon aria-hidden className="size-5" />
              </span>
              <CardTitle className="mt-3 text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </section>
  );
}
