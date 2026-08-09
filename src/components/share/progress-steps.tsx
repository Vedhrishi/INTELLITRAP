import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export type ShareStep = 0 | 1 | 2;

const STEPS = ["Find File", "Verify Access", "Download"];

export function ProgressSteps({ current }: { current: ShareStep }) {
  const fillPercent = current === 0 ? 0 : current === 1 ? 50 : 100;

  return (
    <div className="mx-auto mb-8 flex w-full max-w-md items-center">
      {STEPS.map((label, index) => {
        const state = index < current ? "complete" : index === current ? "active" : "pending";
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={
                  state === "complete"
                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white"
                    : state === "active"
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-[0_0_16px_rgba(59,130,246,0.7)]"
                      : "flex h-9 w-9 items-center justify-center rounded-full bg-[#334155] text-[#94a3b8]"
                }
              >
                {state === "complete" ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
              </div>
              <span
                className={
                  state === "pending" ? "text-xs text-[#64748b]" : "text-xs font-medium text-[#e2e8f0]"
                }
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-[#334155]">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[#3b82f6]"
                  initial={false}
                  animate={{ width: `${index === 0 ? Math.min(fillPercent * 2, 100) : Math.max(fillPercent * 2 - 100, 0)}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
