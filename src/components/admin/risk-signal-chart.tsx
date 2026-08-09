import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { severityColor } from "@/lib/admin/admin-data";

export function RiskSignalChart({ data }: { data: { signal: string; count: number }[] }) {
  return (
    <section className="glass rounded-xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Risk-signal frequency (today)</h2>
      {data.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          No signals recorded yet today
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="signal"
              stroke="#64748b"
              fontSize={11}
              width={160}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.signal} fill={severityColor(entry.signal)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
