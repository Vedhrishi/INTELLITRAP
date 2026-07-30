import { createFileRoute } from "@tanstack/react-router";
import { LandingHero, LandingNav } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter, LandingHow } from "@/components/landing/landing-sections";

const title = "IntelliTrap — Secure Cloud Storage with an AI Deception Layer";
const description =
  "Encrypted cloud file storage that profiles every session, scores risk in real time, and diverts attackers into a monitored AI-analysed honeypot.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingHow />
      <LandingFooter />
    </div>
  );
}
