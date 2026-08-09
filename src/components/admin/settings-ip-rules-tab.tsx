import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toIST } from "@/lib/share/format";
import {
  addWhitelistIp,
  fetchActiveBlocks,
  fetchWhitelist,
  insertManualBlock,
  liftBlock,
  setWhitelist,
} from "@/lib/admin/admin-data";
import { useAuth } from "@/lib/auth/auth-context";

export function SettingsIpRulesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [whitelistIp, setWhitelistIp] = useState("");

  const blocks = useQuery({ queryKey: ["admin-blocks"], queryFn: fetchActiveBlocks });
  const whitelist = useQuery({ queryKey: ["admin-whitelist"], queryFn: fetchWhitelist });

  const blockMutation = useMutation({
    mutationFn: () => insertManualBlock(ip.trim(), reason.trim(), { id: user?.id ?? null }),
    onSuccess: () => {
      setIp("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      toast.success("IP blocked");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to block IP"),
  });

  const liftMutation = useMutation({
    mutationFn: (id: string) => liftBlock(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      toast.success("Block lifted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to unblock"),
  });

  const addWhitelistMutation = useMutation({
    mutationFn: () => addWhitelistIp(whitelistIp.trim()),
    onSuccess: () => {
      setWhitelistIp("");
      void queryClient.invalidateQueries({ queryKey: ["admin-whitelist"] });
      toast.success("IP whitelisted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to whitelist"),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (address: string) => setWhitelist(address, false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-whitelist"] });
      toast.success("Removed from whitelist");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to remove"),
  });

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 text-sm font-semibold">Manually block an IP</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Input
            placeholder="IP address"
            value={ip}
            onChange={(event) => setIp(event.target.value)}
          />
          <Textarea
            placeholder="Reason"
            className="min-h-9"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            disabled={!ip.trim() || !reason.trim() || blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
          >
            Block
          </Button>
        </div>
      </section>

      <section className="glass overflow-hidden rounded-xl">
        <header className="border-b border-border/60 px-4 py-3 text-sm font-semibold">
          Active blocks
        </header>
        <table className="w-full text-left text-xs">
          <tbody>
            {(blocks.data ?? []).map((block) => (
              <tr key={block.id} className="border-t border-border/40">
                <td className="px-4 py-2 font-mono">{block.ip_address}</td>
                <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">
                  {block.reason}
                </td>
                <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                  {toIST(block.blocked_at)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={liftMutation.isPending}
                    onClick={() => liftMutation.mutate(block.id)}
                  >
                    Unblock
                  </Button>
                </td>
              </tr>
            ))}
            {(blocks.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-center text-muted-foreground">
                  No active blocks
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="glass overflow-hidden rounded-xl">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold">Whitelist</h3>
          <div className="flex gap-2">
            <Input
              placeholder="IP address"
              className="h-8 w-40"
              value={whitelistIp}
              onChange={(event) => setWhitelistIp(event.target.value)}
            />
            <Button
              size="sm"
              disabled={!whitelistIp.trim() || addWhitelistMutation.isPending}
              onClick={() => addWhitelistMutation.mutate()}
            >
              Add
            </Button>
          </div>
        </header>
        <table className="w-full text-left text-xs">
          <tbody>
            {(whitelist.data ?? []).map((entry) => (
              <tr key={entry.ip_address} className="border-t border-border/40">
                <td className="px-4 py-2 font-mono">{entry.ip_address}</td>
                <td className="px-4 py-2 text-muted-foreground">{entry.city ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removeWhitelistMutation.isPending}
                    onClick={() => removeWhitelistMutation.mutate(entry.ip_address)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {(whitelist.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-5 text-center text-muted-foreground">
                  No whitelisted IPs
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
