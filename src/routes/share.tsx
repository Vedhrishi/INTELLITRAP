import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Circle,
  Download,
  Mail,
} from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from "sonner";
import { useTracking } from "@/components/tracking/tracking-provider";
import {
  findShareOwner,
  confirmShareDownload,
  verifyFilePassword,
  listSharedFilesForCode,
  resolveShareToken,
  logHoneypotAction,
  applyRiskVerdict,
  checkSelfBlocked,
} from "@/lib/tracking/tracking.functions";
import { formatFileSize } from "@/lib/share/format";
import { behaviorTracker } from "@/lib/tracking/tracker";
import {
  buildFeatures,
  runRandomForest,
  DECISION_SEVERITY,
  type RiskResult,
  type RiskDecision,
} from "@/lib/riskEngine";
import { generateDecoySet, type GeneratedDecoy } from "@/lib/decoyGenerator";
import { SecurityAnalysisPanel } from "@/components/share/security-analysis";
import { AnimatedCheckmark } from "@/components/share/animated-checkmark";
import { ProgressSteps, type ShareStep } from "@/components/share/progress-steps";
import { FileCard } from "@/components/share/file-card";
import { OtpBoxes } from "@/components/share/otp-boxes";

const title = "Secure File Access — IntelliTrap";
const description =
  "Enter the secure share code and password to access a file protected by IntelliTrap.";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

type ShareState =
  | "enter_code"
  | "pick_file"
  | "enter_password"
  | "analyzing"
  | "granted"
  | "challenge"
  | "honeypot"
  | "blocked"
  | "download_complete";

type DecoyTemplate = GeneratedDecoy;

type DecoyItem = {
  template: DecoyTemplate;
  size: number;
  date: Date;
};

type FileData = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  oneTime: boolean;
};

type SharedFileOption = {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  oneTime: boolean;
};

const transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };
const variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -4 },
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildDecoyItem(template: DecoyTemplate): DecoyItem {
  const date = new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000);
  return { template, size: template.fake_size, date };
}

function SharePage() {
  const { sessionToken, visitorId, blocked, logEvent, assessRisk } = useTracking();

  const [shareState, setShareState] = useState<ShareState>("enter_code");
  const [code, setCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeShake, setCodeShake] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<SharedFileOption[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordShake, setPasswordShake] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [decoyItems, setDecoyItems] = useState<DecoyItem[]>([]);
  const [decoyDownloading, setDecoyDownloading] = useState<string | null>(null);

  const [challengeStep, setChallengeStep] = useState<1 | 2>(1);
  const [challengeCaptchaToken, setChallengeCaptchaToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [otpShake, setOtpShake] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [otpFailures, setOtpFailures] = useState(0);
  const [demoOtp, setDemoOtp] = useState("");
  const [invalidCodes, setInvalidCodes] = useState(0);
  const [rfResult, setRfResult] = useState<RiskResult | null>(null);
  const requestTimestamps = useRef<number[]>([]);

  const siteKey = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] as string | undefined;

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const step: ShareStep = useMemo(() => {
    if (shareState === "enter_code" || shareState === "pick_file") return 0;
    if (shareState === "enter_password" || shareState === "analyzing" || shareState === "challenge")
      return 1;
    return 2;
  }, [shareState]);

  async function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionToken || !visitorId || codeLoading) return;
    setCodeLoading(true);
    requestTimestamps.current = [...requestTimestamps.current, Date.now()].slice(-60);
    setCodeError("");
    await logEvent("secret_code_attempt", { code });
    try {
      const result = await findShareOwner({
        data: { secret_code: code.trim(), session_token: sessionToken, visitor_id: visitorId },
      });
      if (result.blocked) {
        setShareState("blocked");
        return;
      }
      if (result.found) {
        setOwnerName(result.ownerName);
        // One code can cover several shared files, so the recipient chooses
        // which one before the password step.
        const listed = await listSharedFilesForCode({
          data: { secret_code: code.trim(), session_token: sessionToken },
        });
        if (listed.blocked) {
          setShareState("blocked");
          return;
        }
        setSharedFiles(listed.files);
        if (listed.files.length > 1) {
          setSelectedFileId(null);
          setShareState("pick_file");
        } else {
          setSelectedFileId(listed.files[0]?.id ?? null);
          setShareState("enter_password");
        }
      } else {
        setInvalidCodes((value) => value + 1);
        triggerCodeShake("No files found for this code. Double-check with the owner.");
      }
    } catch {
      triggerCodeShake("Something went wrong. Please try again.");
    } finally {
      setCodeLoading(false);
    }
  }

  function triggerCodeShake(message: string) {
    setCodeError(message);
    setCodeShake(true);
    window.setTimeout(() => setCodeShake(false), 500);
    window.setTimeout(() => setCodeError(""), 2000);
  }

  function triggerPasswordShake(message: string) {
    setPasswordError(message);
    setPasswordShake(true);
    window.setTimeout(() => setPasswordShake(false), 500);
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionToken || !visitorId || passwordLoading) return;
    if (failedAttempts >= 3 && !captchaToken) return;
    setPasswordLoading(true);
    requestTimestamps.current = [...requestTimestamps.current, Date.now()].slice(-60);
    setPasswordError("");
    try {
      const result = await verifyFilePassword({
        data: {
          secret_code: code.trim(),
          password,
          ...(selectedFileId ? { file_id: selectedFileId } : {}),
          session_token: sessionToken,
          visitor_id: visitorId,
        },
      });
      if (result.blocked) {
        setShareState("blocked");
        return;
      }
      if ("honeypot" in result && result.honeypot) {
        setShareState("honeypot");
        return;
      }
      if (result.success) {
        setFileData({
          id: result.fileId,
          name: result.fileName,
          size: result.fileSize,
          type: result.fileType,
          url: result.url ?? "",
          oneTime: result.oneTime,
        });
        setShareState("analyzing");
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setCaptchaToken(null);
        triggerPasswordShake(result.error);
      }
    } catch {
      triggerPasswordShake("Something went wrong. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  }

  useEffect(() => {
    if (shareState !== "analyzing") return;
    let cancelled = false;
    void (async () => {
      const server = await assessRisk();
      const behavior = behaviorTracker.snapshot();
      const features = buildFeatures({
        failedPasswords: failedAttempts,
        failedCodes: invalidCodes,
        mouseMovements: behavior.mouseMovements,
        keystrokeAvgMs: behavior.avgKeystrokeMs,
        scrollEvents: behavior.scrolls,
        pageViews: 1,
        timeOnPageSeconds: behavior.timeOnSite,
        userAgent: navigator.userAgent,
        requestTimestamps: requestTimestamps.current,
      });
      const forest = runRandomForest(features);
      setRfResult(forest);

      // The server verdict always wins when it is stricter — the client can
      // never talk itself into access.
      const serverDecision = (server?.decision ?? "granted") as RiskDecision;
      const decision: RiskDecision =
        DECISION_SEVERITY[serverDecision] > DECISION_SEVERITY[forest.decision]
          ? serverDecision
          : forest.decision;

      if (sessionToken && visitorId) {
        try {
          await applyRiskVerdict({
            data: {
              session_token: sessionToken,
              visitor_id: visitorId,
              decision,
              score: forest.score,
              confidence: forest.confidence,
              tree_votes: forest.treeVotes,
              top_signals: forest.topSignals,
              breakdown: forest.breakdown,
            },
          });
        } catch {
          /* enforcement must never break the page */
        }
      }

      window.setTimeout(() => {
        if (cancelled) return;
        if (decision === "captcha_mfa") setShareState("challenge");
        else if (decision === "honeypot") setShareState("honeypot");
        else if (decision === "blocked") setShareState("blocked");
        else setShareState("granted");
      }, 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, [shareState, assessRisk, failedAttempts, invalidCodes, sessionToken, visitorId]);

  // Repeat visitors who were already auto-blocked never see the form again.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await checkSelfBlocked();
        if (!cancelled && result?.blocked) setShareState("blocked");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Link-only share: /share?t=<token> skips both the code and password screens
  // and goes straight into the risk check.
  const tokenHandled = useRef(false);
  useEffect(() => {
    if (tokenHandled.current || !sessionToken || !visitorId) return;
    const shareTokenParam = new URLSearchParams(window.location.search).get("t");
    if (!shareTokenParam) return;
    tokenHandled.current = true;
    void (async () => {
      try {
        const result = await resolveShareToken({
          data: {
            share_token: shareTokenParam,
            session_token: sessionToken,
            visitor_id: visitorId,
          },
        });
        if ("blocked" in result && result.blocked) {
          setShareState("blocked");
          return;
        }
        if ("honeypot" in result && result.honeypot) {
          setShareState("honeypot");
          return;
        }
        if (result.success) {
          setOwnerName(result.ownerName);
          setFileData({
            id: result.fileId,
            name: result.fileName,
            size: result.fileSize,
            type: result.fileType,
            url: result.url,
            oneTime: result.oneTime,
          });
          setShareState("analyzing");
        } else {
          setLinkError(result.error);
        }
      } catch {
        setLinkError("Something went wrong opening this link.");
      }
    })();
  }, [sessionToken, visitorId]);

  useEffect(() => {
    if (shareState !== "honeypot") return;
    let cancelled = false;
    void (async () => {
      if (!sessionToken) return;
      await logEvent("honeypot_entered");
      try {
        // Decoys are generated locally, so the trap can never fail on an
        // empty template table.
        const decoys = generateDecoySet(3);
        if (cancelled) return;
        setDecoyItems(decoys.map(buildDecoyItem));
      } catch {
        /* honeypot must never surface errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareState, sessionToken, logEvent]);

  async function downloadRealFile() {
    if (!fileData || downloading) return;
    setDownloading(true);
    try {
      // Fetch the bytes first: that way we know the object really exists before
      // the link is burned, and a missing object shows a clear message.
      const response = await fetch(fileData.url);
      if (!response.ok) throw new Error(`storage ${response.status}`);
      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileData.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      await logEvent("file_download_real", { file: fileData.name });
      if (fileData.oneTime && sessionToken && fileData.id) {
        await confirmShareDownload({
          data: { session_token: sessionToken, file_id: fileData.id },
        }).catch(() => {});
      }
      toast.success("Download started successfully.");
      window.setTimeout(() => {
        setShareState("download_complete");
        setDownloading(false);
      }, 1500);
    } catch {
      toast.error("This file is no longer available. Ask the sender to share it again.");
      setDownloading(false);
    }
  }

  async function downloadDecoy(item: DecoyItem) {
    if (decoyDownloading) return;
    setDecoyDownloading(item.template.id);
    try {
      const blob = new Blob([item.template.content], { type: item.template.mime_type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.template.file_name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      if (sessionToken && visitorId) {
        await logHoneypotAction({
          data: {
            session_token: sessionToken,
            visitor_id: visitorId,
            action: "download_decoy",
            decoy_file_name: item.template.file_name,
          },
        });
        await logEvent("file_download_decoy", { file: item.template.file_name });
      }
      toast.success("Download started successfully.");
    } finally {
      setDecoyDownloading(null);
    }
  }

  function resetAll() {
    setShareState("enter_code");
    setCode("");
    setOwnerName("");
    setCodeError("");
    setPassword("");
    setPasswordError("");
    setFailedAttempts(0);
    setCaptchaToken(null);
    setFileData(null);
    setDecoyItems([]);
    setChallengeStep(1);
    setChallengeCaptchaToken(null);
    setEmail("");
    setOtpSent(false);
    setOtpValues(Array(6).fill(""));
    setOtpFailures(0);
    setDemoOtp("");
    setInvalidCodes(0);
    setRfResult(null);
  }

  async function sendOtp() {
    if (resendCountdown > 0) return;
    const code6 = String(randomInt(100000, 999999));
    setDemoOtp(code6);
    setOtpSent(true);
    setResendCountdown(60);
    await logEvent("otp_sent", { email });
    toast.success(`Demo OTP: ${code6}`);
  }

  async function verifyOtp(enteredCode: string) {
    if (enteredCode === demoOtp) {
      setOtpError(false);
      await logEvent("otp_passed");
      window.setTimeout(() => setShareState("granted"), 600);
    } else {
      const nextFailures = otpFailures + 1;
      setOtpFailures(nextFailures);
      setOtpError(true);
      setOtpShake(true);
      window.setTimeout(() => setOtpShake(false), 500);
      await logEvent("otp_failed");
      if (nextFailures >= 3) {
        window.setTimeout(() => setShareState("honeypot"), 1000);
      } else {
        window.setTimeout(() => {
          setOtpValues(Array(6).fill(""));
          setOtpError(false);
        }, 600);
      }
    }
  }

  async function onChallengeCaptcha(token: string | null) {
    if (!token) {
      await logEvent("captcha_failed");
      setShareState("honeypot");
      return;
    }
    setChallengeCaptchaToken(token);
    await logEvent("captcha_passed");
    setChallengeStep(2);
  }

  const effectiveState: ShareState = blocked ? "blocked" : shareState;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020817]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: "radial-gradient(circle at top, rgba(59,130,246,0.06), transparent 60%)",
        }}
      />
      <div
        className="scanline pointer-events-none fixed inset-x-0 top-0 z-0 h-px bg-[#3b82f6]"
        style={{ opacity: 0.1 }}
      />

      {effectiveState !== "blocked" ? (
        <div className="fixed right-4 top-4 z-30 rounded-full border border-[#334155] bg-[#1e293b]/70 px-3 py-1.5 text-xs text-[#94a3b8] backdrop-blur-md">
          🔒 End-to-end encrypted
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-4 py-12">
        {effectiveState !== "blocked" ? (
          <div className="mb-10 flex flex-col items-center gap-1 text-center">
            <ShieldCheck className="slow-spin h-8 w-8 text-[#3b82f6]" />
            <h1
              className="text-3xl font-black"
              style={{
                backgroundImage: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              IntelliTrap
            </h1>
            <p className="text-sm text-[#64748b]">Secure File Access</p>
          </div>
        ) : null}

        {effectiveState !== "blocked" ? <ProgressSteps current={step} /> : null}

        <AnimatePresence mode="wait">
          {effectiveState === "enter_code" ? (
            <motion.div
              key="enter_code"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1e293b]/80 p-8 backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3b82f6]/10"
              >
                <Lock className="h-7 w-7 text-[#3b82f6]" />
              </motion.div>
              <h2 className="text-center text-2xl font-bold text-white">Enter Secret Code</h2>
              <p className="mt-2 text-center text-sm text-[#64748b]">
                Ask the file owner for their unique 8-character code.
              </p>
              <form onSubmit={handleCodeSubmit} className="mt-6 space-y-4">
                <motion.input
                  animate={codeShake ? { x: [0, 12, -12, 12, -12, 6, -6, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="HYD-X7K2"
                  className={
                    "w-full rounded-lg border-2 bg-[#0f172a] px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.25em] text-white outline-none transition-colors " +
                    (codeError ? "border-red-500" : "border-[#334155] focus:border-[#3b82f6]")
                  }
                />
                {codeError ? <p className="text-center text-sm text-red-400">{codeError}</p> : null}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={codeLoading || code.trim().length < 4}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3b82f6] py-3 font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {codeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Find File Owner
                </motion.button>
              </form>
            </motion.div>
          ) : null}

          {effectiveState === "enter_password" ? (
            <motion.div
              key="enter_password"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1e293b]/80 p-8 backdrop-blur-xl"
            >
              <motion.div
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400"
              >
                Files shared by {ownerName}
              </motion.div>
              <h2 className="text-xl font-bold text-white">Enter File Password</h2>
              <p className="mt-1 text-sm text-[#94a3b8]">
                This file is protected. Enter the password provided by the sender.
              </p>
              <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
                <motion.div
                  animate={passwordShake ? { x: [0, 12, -12, 12, -12, 6, -6, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    className={
                      "w-full rounded-lg border-2 bg-[#0f172a] px-4 py-3 pr-11 text-white outline-none transition-colors " +
                      (passwordError ? "border-red-500" : "border-[#334155] focus:border-[#3b82f6]")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </motion.div>
                {passwordError ? <p className="text-sm text-red-400">{passwordError}</p> : null}
                {failedAttempts > 0 && failedAttempts < 3 ? (
                  <p className="text-sm text-amber-400">
                    {3 - failedAttempts} attempts remaining before verification required
                  </p>
                ) : null}
                <AnimatePresence>
                  {failedAttempts >= 3 ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {siteKey ? (
                        <ReCAPTCHA
                          sitekey={siteKey}
                          theme="dark"
                          onChange={(value) => setCaptchaToken(value)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCaptchaToken("mock-token")}
                          className={
                            "w-full rounded-lg border py-2 text-sm font-medium " +
                            (captchaToken
                              ? "border-green-500 bg-green-500/10 text-green-400"
                              : "border-[#334155] bg-[#0f172a] text-[#94a3b8]")
                          }
                        >
                          {captchaToken ? "✓ Verified" : "Verify I'm human"}
                        </button>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={passwordLoading || !password || (failedAttempts >= 3 && !captchaToken)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3b82f6] py-3 font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Unlock File
                </motion.button>
              </form>
            </motion.div>
          ) : null}

          {effectiveState === "analyzing" ? (
            <motion.div
              key="analyzing"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="flex w-full flex-col items-center py-10"
            >
              <div className="relative h-40 w-40">
                <div className="slow-spin absolute inset-0 rounded-full border-2 border-[#3b82f6]/20" />
                <div
                  className="absolute inset-1 rounded-full border-2 border-[#8b5cf6]/30"
                  style={{ animation: "slowSpin 6s linear infinite reverse" }}
                />
                <div className="orbit-1 absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3b82f6]" />
                <div className="orbit-2 absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b5cf6]" />
                <div className="orbit-3 absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#06b6d4]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck
                    className="h-10 w-10 animate-pulse text-[#3b82f6]"
                    style={{ filter: "drop-shadow(0 0 10px #3b82f6)" }}
                  />
                </div>
              </div>
              <h2 className="mt-6 text-xl font-bold text-white">Verifying Access...</h2>
              <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-[#334155]">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "linear" }}
                  className="h-full bg-[#3b82f6]"
                />
              </div>
              <div className="mt-6 space-y-2 text-sm text-[#94a3b8]">
                {[
                  { label: "Identity verified", delay: 0.2 },
                  { label: "Checking threat database", delay: 0.5 },
                  { label: "Analyzing behavioral patterns", delay: 0.9 },
                  { label: "Calculating access permissions", delay: 1.2 },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: item.delay }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {item.label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}

          {effectiveState === "granted" ? (
            <motion.div
              key="granted"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="flex w-full max-w-md flex-col items-center py-6 text-center"
            >
              <AnimatedCheckmark />
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-4 bg-clip-text text-2xl font-black text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#4ade80,#10b981)" }}
              >
                Access Granted
              </motion.h2>
              {fileData ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="mt-6 w-full"
                >
                  <FileCard
                    name={fileData.name}
                    size={fileData.size}
                    type={fileData.type}
                    oneTime={fileData.oneTime}
                    uploadedLabel={`Shared by ${ownerName}`}
                  >
                    <button
                      onClick={downloadRealFile}
                      disabled={downloading}
                      className="shimmer-btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white disabled:opacity-70"
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" /> Download File
                        </>
                      )}
                    </button>
                  </FileCard>
                </motion.div>
              ) : null}
              {rfResult ? <SecurityAnalysisPanel result={rfResult} /> : null}
            </motion.div>
          ) : null}

          {effectiveState === "honeypot" ? (
            <motion.div
              key="honeypot"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="flex w-full max-w-md flex-col items-center py-6 text-center"
            >
              <AnimatedCheckmark />
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-4 bg-clip-text text-2xl font-black text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#4ade80,#10b981)" }}
              >
                Access Granted
              </motion.h2>
              {decoyItems[0] ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="mt-6 w-full"
                >
                  <FileCard
                    name={decoyItems[0].template.file_name}
                    size={decoyItems[0].size}
                    type={decoyItems[0].template.mime_type}
                    uploadedLabel={`Shared by ${ownerName}`}
                  >
                    <button
                      onClick={() => void downloadDecoy(decoyItems[0]!)}
                      disabled={decoyDownloading === decoyItems[0].template.id}
                      className="shimmer-btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white disabled:opacity-70"
                    >
                      {decoyDownloading === decoyItems[0].template.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" /> Download File
                        </>
                      )}
                    </button>
                  </FileCard>
                  {decoyItems.length > 1 ? (
                    <div className="mt-6 text-left">
                      <p className="mb-2 text-sm text-[#94a3b8]">
                        Related files you may also need:
                      </p>
                      <div className="space-y-2">
                        {decoyItems.slice(1).map((item) => (
                          <div
                            key={item.template.id}
                            className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white">
                                {item.template.file_name}
                              </p>
                              <p className="text-xs text-[#64748b]">{formatFileSize(item.size)}</p>
                            </div>
                            <button
                              onClick={() => void downloadDecoy(item)}
                              disabled={decoyDownloading === item.template.id}
                              className="rounded-md bg-green-600/90 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-70"
                            >
                              {decoyDownloading === item.template.id ? "..." : "Download"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
              {rfResult ? <SecurityAnalysisPanel result={rfResult} /> : null}
            </motion.div>
          ) : null}

          {effectiveState === "challenge" ? (
            <motion.div
              key="challenge"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#1e293b]/80 p-8 backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <ShieldAlert className="h-7 w-7 animate-pulse text-amber-400" />
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  Step {challengeStep} of 2
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Additional Verification Required</h2>
              <p className="mt-1 text-sm text-[#94a3b8]">
                We need to confirm you're not a bot before granting access.
              </p>

              {challengeStep === 1 ? (
                <div className="mt-6 flex justify-center">
                  {siteKey ? (
                    <ReCAPTCHA
                      sitekey={siteKey}
                      theme="dark"
                      onChange={(value) => void onChallengeCaptcha(value)}
                      onExpired={() => void onChallengeCaptcha(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onChallengeCaptcha("mock-token")}
                      className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-sm font-medium text-amber-300"
                    >
                      Verify I'm human
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2">
                    <Mail className="h-4 w-4 text-[#64748b]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void sendOtp()}
                      disabled={!email || resendCountdown > 0}
                      className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                    >
                      {resendCountdown > 0
                        ? `Resend (${resendCountdown}s)`
                        : otpSent
                          ? "Resend Code"
                          : "Send Code"}
                    </button>
                  </div>
                  {otpSent ? (
                    <div>
                      <p className="mb-3 text-center text-sm text-[#94a3b8]">
                        Enter the 6-digit code sent to your email
                      </p>
                      <OtpBoxes
                        values={otpValues}
                        onChange={setOtpValues}
                        onComplete={(value) => void verifyOtp(value)}
                        shake={otpShake}
                        error={otpError}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </motion.div>
          ) : null}

          {effectiveState === "blocked" ? (
            <BlockedState key="blocked" sessionToken={sessionToken} result={rfResult} />
          ) : null}

          {effectiveState === "download_complete" ? (
            <motion.div
              key="download_complete"
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={transition}
              className="flex w-full max-w-md flex-col items-center py-6 text-center"
            >
              <AnimatedCheckmark />
              <h2 className="mt-4 text-2xl font-bold text-white">Downloaded Successfully!</h2>
              {fileData?.oneTime ? (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
                  This one-time file has now been permanently removed from the server.
                </p>
              ) : null}
              <button
                onClick={resetAll}
                className="mt-6 text-sm font-medium text-[#3b82f6] hover:underline"
              >
                Access another file →
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BlockedState({
  sessionToken,
  result,
}: {
  sessionToken: string | null;
  result: RiskResult | null;
}) {
  const particles = useRef(
    Array.from({ length: 20 }, () => ({
      left: `${randomInt(0, 100)}%`,
      size: randomInt(2, 6),
      duration: randomInt(4, 9),
      delay: randomInt(0, 5),
    })),
  ).current;

  return (
    <motion.div
      key="blocked"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0000] px-4 text-center"
    >
      {particles.map((particle, index) => (
        <div
          key={index}
          className="particle-float pointer-events-none absolute bottom-0 rounded-full bg-red-500"
          style={{
            left: particle.left,
            width: particle.size,
            height: particle.size,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      <svg viewBox="0 0 100 100" width={120} height={120} className="critical-glow-filter">
        <path
          d="M50 5 L90 20 V50 C90 75 70 90 50 95 C30 90 10 75 10 50 V20 Z"
          fill="none"
          stroke="#ef4444"
          strokeWidth={4}
          strokeDasharray={600}
          className="draw-shield"
        />
        <line
          x1="35"
          y1="40"
          x2="65"
          y2="65"
          stroke="#ef4444"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <line
          x1="65"
          y1="40"
          x2="35"
          y2="65"
          stroke="#ef4444"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </svg>

      <motion.h1
        initial={{ scale: 0.7, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="mt-6 bg-clip-text text-[3.5rem] font-black leading-none text-transparent"
        style={{ backgroundImage: "linear-gradient(135deg,#ef4444,#7f1d1d)" }}
      >
        ACCESS DENIED
      </motion.h1>

      <p className="mt-6 max-w-md text-sm text-[#94a3b8]">
        Suspicious activity was detected by our AI security system. This incident has been logged
        and reported to the security team.
      </p>

      {sessionToken ? (
        <p className="mt-4 font-mono text-xs text-[#64748b]">
          Reference: {sessionToken.slice(0, 8).toUpperCase()}
        </p>
      ) : null}

      {result ? (
        <div className="w-full max-w-md">
          <SecurityAnalysisPanel result={result} />
        </div>
      ) : null}
    </motion.div>
  );
}
