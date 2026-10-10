import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Enrollment = { factorId: string; uri: string; secret: string };

/** Authenticator-app (TOTP) enrolment and removal. */
export function MfaSettings() {
  const [loading, setLoading] = useState(true);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setActiveFactorId(data?.totp?.[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEnroll = async () => {
    setBusy(true);
    // Clear half-finished enrolments, otherwise enroll() fails with a duplicate factor name.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "IntelliTrap authenticator",
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Could not start two-step setup. Is MFA enabled in the backend auth settings?");
      return;
    }
    setEnrollment({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
  };

  const confirmEnroll = async () => {
    if (!enrollment) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error("That code was not accepted. Try the next code from your app.");
      setCode("");
      return;
    }
    toast.success("Two-step verification is on");
    setEnrollment(null);
    setCode("");
    void load();
  };

  const disable = async () => {
    if (!activeFactorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
    setBusy(false);
    if (error) {
      toast.error("Could not turn off two-step verification.");
      return;
    }
    toast.success("Two-step verification is off");
    void load();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  return (
    <div className="glass-elevated max-w-md space-y-4 rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="text-base font-semibold">Two-step verification</h2>
      </div>
      {activeFactorId ? (
        <>
          <p className="text-sm text-muted-foreground">
            On. You will be asked for an authenticator code each time you sign in.
          </p>
          <Button variant="destructive" onClick={() => void disable()} disabled={busy}>
            Turn off
          </Button>
        </>
      ) : enrollment ? (
        <>
          <p className="text-sm text-muted-foreground">
            Scan this QR code with an authenticator app, then enter the 6-digit code.
          </p>
          <div className="inline-block rounded-lg bg-white p-3">
            <QRCodeSVG value={enrollment.uri} size={160} />
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">
            Manual key: {enrollment.secret}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="enroll-code">Code</Label>
            <Input
              id="enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button onClick={() => void confirmEnroll()} disabled={busy || code.length !== 6}>
            Confirm
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Add a second step to sign-in with an authenticator app (Google Authenticator, 1Password,
            Authy).
          </p>
          <Button onClick={() => void startEnroll()} disabled={busy}>
            Set up
          </Button>
        </>
      )}
    </div>
  );
}
