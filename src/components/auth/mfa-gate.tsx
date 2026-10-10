import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

type GateState = "checking" | "challenge" | "ok";

/**
 * Blocks the app until a user who enrolled an authenticator app has proven the second factor
 * (session AAL2). This is a UI gate; to also enforce it in the database, add `aal2` checks to
 * RLS policies (see SECURITY.md).
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      // Fail open only when MFA state cannot be read at all; RLS remains the real boundary.
      setState("ok");
      return;
    }
    if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
        setState("challenge");
        return;
      }
    }
    setState("ok");
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const verify = async () => {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      toast.error("That code was not accepted. Check your authenticator app and try again.");
      setCode("");
      return;
    }
    setState("ok");
  };

  if (state === "ok") return <>{children}</>;
  if (state === "checking")
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        className="glass-elevated w-full max-w-sm space-y-4 rounded-2xl p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Two-step verification</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">Authentication code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Verify
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </form>
    </div>
  );
}
