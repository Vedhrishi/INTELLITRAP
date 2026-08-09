import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";

const title = "Access denied";
const description = "This IP address has been blocked from accessing IntelliTrap.";

export const Route = createFileRoute("/blocked")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlockedPage,
});

function BlockedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0000] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-5"
      >
        <ShieldX
          aria-hidden
          className="size-20 text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.55)]"
        />
        <h1 className="text-3xl font-bold tracking-tight text-red-500">Access Denied</h1>
        <p className="text-sm text-red-200/80">Your IP address has been blocked.</p>
        <p className="text-xs text-red-200/50">This incident has been logged.</p>
      </motion.div>
    </main>
  );
}
