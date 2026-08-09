import { LEVEL_BAR_CLASS, LEVEL_TEXT_CLASS, type RiskResult } from "@/lib/riskEngine";

/**
 * Compact ML output panel. Rendered identically on granted and honeypot so the
 * trap stays indistinguishable from a real grant.
 */
export function SecurityAnalysisPanel({ result }: { result: RiskResult }) {
  const votes = result.treeVotes;

  return (
    <div className="mt-8 w-full rounded-xl border border-[#334155] bg-[#0f172a]/80 p-4 text-left">
      <p className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
        Security Analysis
      </p>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#1e293b]">
          <div
            className={`h-full rounded-full transition-all ${LEVEL_BAR_CLASS[result.level]}`}
            style={{ width: `${Math.max(result.score, 2)}%` }}
          />
        </div>
        <p className={`mt-2 font-mono text-xs ${LEVEL_TEXT_CLASS[result.level]}`}>
          {result.score}/100 — {result.level.toUpperCase()}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs">
        <span className="text-green-400">✓ {votes.granted} trees: Safe</span>
        <span className="text-amber-400">⚠ {votes.captcha_mfa} trees: Caution</span>
        <span className="text-orange-400">🍯 {votes.honeypot} trees: Suspect</span>
        <span className="text-red-400">🚫 {votes.blocked} trees: Threat</span>
      </div>

      <p className="mt-3 text-xs text-slate-400">{result.confidence}% model confidence</p>

      {result.topSignals.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-[#64748b]">Signals detected:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {result.topSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
