import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/primitives/empty-state";
import { fetchAuthFailures, fetchAuthFailureSummary } from "@/lib/admin/admin-data";

const REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Wrong password",
  already_registered: "Email already registered",
  email_not_confirmed: "Email not confirmed",
  invalid_email: "Invalid email",
  weak_password: "Weak / breached password",
  signup_disabled: "Signups closed",
  rate_limited: "Rate limited",
  expired_link: "Expired link",
  network: "Network error",
  other: "Other",
};

const HIGH_SIGNAL = new Set(["invalid_credentials", "rate_limited", "expired_link"]);

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason;
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function AuthFailurePanel() {
  const failures = useQuery({
    queryKey: ["auth-failures"],
    queryFn: () => fetchAuthFailures(50),
    refetchInterval: 15_000,
  });
  const summary = useQuery({
    queryKey: ["auth-failure-summary"],
    queryFn: fetchAuthFailureSummary,
    refetchInterval: 30_000,
  });

  const rows = failures.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert aria-hidden className="size-4 text-warning" />
          Authentication failures
        </CardTitle>
        <CardDescription>
          Sign-in, registration and reset failures. Emails are masked and no passwords or tokens are
          ever stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(summary.data?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.data?.map((item) => (
              <Badge
                key={item.reason}
                variant={HIGH_SIGNAL.has(item.reason) ? "destructive" : "secondary"}
              >
                {reasonLabel(item.reason)} · {item.count} today
              </Badge>
            ))}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No failed attempts recorded"
            description="Failed sign-ins and registrations will appear here as they happen."
          />
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Flow</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Origin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {timeAgo(row.created_at)}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.flow.replace("_", " ")}</td>
                    <td className="px-3 py-2">
                      <Badge variant={HIGH_SIGNAL.has(row.reason) ? "destructive" : "secondary"}>
                        {reasonLabel(row.reason)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono-data text-xs">{row.masked_email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-mono-data">{row.ip_address ?? "—"}</span>
                      {row.city || row.country ? (
                        <span> · {[row.city, row.country].filter(Boolean).join(", ")}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
