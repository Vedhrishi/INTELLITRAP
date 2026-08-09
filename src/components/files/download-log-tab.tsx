import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/primitives/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { toIST } from "@/lib/share/format";
import type { FileAccessLogRow, FileRow } from "./types";

type LogEntry = FileAccessLogRow & { fileName: string };

const OUTCOME_STYLES: Record<string, string> = {
  success: "bg-green-500/15 text-green-400 border-green-500/30",
  wrong_password: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

function extractGeoLabel(geo: FileAccessLogRow["geo_data"]): string {
  if (!geo || typeof geo !== "object" || Array.isArray(geo)) return "—";
  const record = geo as Record<string, unknown>;
  const city = typeof record["city"] === "string" ? record["city"] : null;
  const isp = typeof record["isp"] === "string" ? record["isp"] : null;
  return [city, isp].filter(Boolean).join(" · ") || "—";
}

export function DownloadLogTab({ userId }: { userId: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["download-log", userId],
    queryFn: async (): Promise<LogEntry[]> => {
      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, name")
        .eq("owner_id", userId);
      if (filesError) throw filesError;
      const fileList = (files ?? []) as Pick<FileRow, "id" | "name">[];
      const fileIds = fileList.map((file) => file.id);
      if (fileIds.length === 0) return [];

      const { data: logs, error: logsError } = await supabase
        .from("file_access_log")
        .select("*")
        .in("file_id", fileIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (logsError) throw logsError;

      const nameById = new Map(fileList.map((file) => [file.id, file.name]));
      return ((logs ?? []) as FileAccessLogRow[]).map((log) => ({
        ...log,
        fileName: (log.file_id && nameById.get(log.file_id)) || "Unknown file",
      }));
    },
  });

  if (isLoading) {
    return <p className="text-sm text-[#94a3b8]">Loading download log…</p>;
  }

  if (!entries || entries.length === 0) {
    return <EmptyState title="No download activity yet" description="Downloads of your shared files will appear here." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#334155]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#334155] hover:bg-transparent">
            <TableHead>File</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>City / ISP</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Risk score</TableHead>
            <TableHead>Time (IST)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="border-[#334155]">
              <TableCell className="max-w-[180px] truncate">{entry.fileName}</TableCell>
              <TableCell className="font-mono text-xs text-slate-200">{entry.ip_address}</TableCell>
              <TableCell className="text-[#94a3b8]">{extractGeoLabel(entry.geo_data)}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={OUTCOME_STYLES[entry.outcome ?? ""] ?? "bg-[#334155]/40 text-[#94a3b8] border-[#334155]"}
                >
                  {entry.outcome ?? "unknown"}
                </Badge>
              </TableCell>
              <TableCell className="text-[#94a3b8]">{entry.risk_score_at_access ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-[#94a3b8]">{toIST(entry.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
