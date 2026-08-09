import { useQuery } from "@tanstack/react-query";
import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchLatestMlAnalysis } from "@/lib/admin/admin-data";
import { levelForScore, LEVEL_TEXT_CLASS } from "@/lib/riskEngine";
import { toIST } from "@/lib/share/format";

const LEVEL_HEX: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#fb923c",
  critical: "#ef4444",
};

export function MlAnalysisPanel() {
  const analysis = useQuery({
    queryKey: ["admin-ml-analysis"],
    queryFn: fetchLatestMlAnalysis,
    refetchInterval: 20_000,
  });

  if (analysis.isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const data = analysis.data;
  const level = levelForScore(data?.score ?? 0);
  const colour = LEVEL_HEX[level] ?? "#22c55e";
  const factors = Object.entries(data?.breakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const totalPoints = factors.reduce((sum, [, points]) => sum + points, 0);

  return (
    <section className="glass overflow-hidden rounded-xl">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">ML Analysis — Random Forest</h2>
        {data ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {data.ip} · {toIST(data.at)}
          </span>
        ) : null}
      </header>

      {!data ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No model verdicts recorded yet. They appear as soon as a visitor is analysed.
        </p>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={[{ name: "score", value: data.score, fill: colour }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-mono text-3xl font-semibold ${LEVEL_TEXT_CLASS[level]}`}>
                {data.score}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {level} · {data.confidence}% conf.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Factor</th>
                  <th className="px-2 py-2 font-medium">Points</th>
                  <th className="px-2 py-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {factors.map(([factor, points]) => (
                  <tr key={factor} className="border-t border-border/40">
                    <td className="px-2 py-2">{factor}</td>
                    <td className="px-2 py-2 font-mono">{points}</td>
                    <td className="px-2 py-2 font-mono text-muted-foreground">
                      {totalPoints > 0 ? Math.round((points / totalPoints) * 100) : 0}%
                    </td>
                  </tr>
                ))}
                {factors.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                      No risk factors triggered — clean session.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[11px] sm:grid-cols-4">
              <span className="text-green-400">✓ {data.treeVotes.granted} Safe</span>
              <span className="text-amber-400">⚠ {data.treeVotes.captcha_mfa} Caution</span>
              <span className="text-orange-400">🍯 {data.treeVotes.honeypot} Suspect</span>
              <span className="text-red-400">🚫 {data.treeVotes.blocked} Threat</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
