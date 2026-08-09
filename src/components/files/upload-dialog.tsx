import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize, hashPassword, passwordStrength } from "@/lib/share/format";
import { FileTypeIcon } from "./file-type-icon";
import {
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE,
  USER_MAX_FILES,
  USER_STORAGE_QUOTA,
  usedBytes,
  type FileRow,
} from "./types";


const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"];

function expiryToDate(value: ExpiryValue): string | null {
  const now = Date.now();
  if (value === "24h") return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (value === "7d") return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (value === "30d") return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

function isBlockedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function uploadWithProgress(params: {
  url: string;
  anonKey: string;
  accessToken: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<boolean> {
  const { url, anonKey, accessToken, file, onProgress } = params;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(true);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadDialog({
  open,
  onOpenChange,
  userSecretCode,
  existingFiles = [],
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userSecretCode: string | null;
  existingFiles?: FileRow[];
  onUploaded: () => void;
}) {

  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oneTime, setOneTime] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryValue>("never");

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [savedPasswordModal, setSavedPasswordModal] = useState(false);
  const [savedPasswordValue, setSavedPasswordValue] = useState("");
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setDragActive(false);
    setSharingEnabled(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setOneTime(false);
    setExpiry("never");
    setProgress(0);
    setUploading(false);
  }, []);

  const validateAndSetFile = useCallback(
    (candidate: File) => {
      if (isBlockedExtension(candidate.name)) {
        toast.error("This file type is not allowed");
        return;
      }
      if (candidate.size > MAX_FILE_SIZE) {
        toast.error("File too large. 1GB max.");
        return;
      }
      if (existingFiles.length >= USER_MAX_FILES) {
        toast.error("Storage full. Delete files to free space.");
        return;
      }
      if (usedBytes(existingFiles) + candidate.size > USER_STORAGE_QUOTA) {
        toast.error("Storage full. Delete files to free space.");
        return;
      }
      setFile(candidate);
    },
    [existingFiles],
  );


  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer.files[0];
      if (dropped) validateAndSetFile(dropped);
    },
    [validateAndSetFile],
  );

  const strength = passwordStrength(password);
  const passwordValid = password.length >= 4 && password.length <= 20;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const canProceedStep2 = !sharingEnabled || (passwordValid && passwordsMatch);

  const startUpload = useCallback(async () => {
    if (!file || !user) return;
    if (
      existingFiles.length >= USER_MAX_FILES ||
      usedBytes(existingFiles) + file.size > USER_STORAGE_QUOTA
    ) {
      toast.error("Storage full. Delete files to free space.");
      return;
    }

    setStep(3);
    setUploading(true);
    setProgress(0);

    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (supabaseUrl && anonKey && accessToken) {
        await uploadWithProgress({
          url: `${supabaseUrl}/storage/v1/object/user-files/${path}`,
          anonKey,
          accessToken,
          file,
          onProgress: setProgress,
        });
      } else {
        const { error } = await supabase.storage.from("user-files").upload(path, file);
        if (error) throw error;
        setProgress(100);
      }

      const passwordHash = sharingEnabled ? await hashPassword(password) : null;

      const { error: insertError } = await supabase.from("files").insert({
        owner_id: user.id,
        name: file.name,
        size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: path,
        is_shared: sharingEnabled,
        file_password_hash: passwordHash,
        one_time: sharingEnabled ? oneTime : false,
        expires_at: sharingEnabled ? expiryToDate(expiry) : null,
        uploader_secret_code: userSecretCode,
      });

      if (insertError) throw insertError;

      onUploaded();

      if (sharingEnabled) {
        setSavedPasswordValue(password);
        setSavedPasswordModal(true);
      } else {
        toast.success("File uploaded successfully!");
        onOpenChange(false);
        reset();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      setStep(2);
    } finally {
      setUploading(false);
    }
  }, [existingFiles, expiry, file, onOpenChange, onUploaded, oneTime, password, reset, sharingEnabled, user, userSecretCode]);

  const closeSavedPasswordModal = useCallback(() => {
    setSavedPasswordModal(false);
    setConfirmedSaved(false);
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && uploading) return;
          onOpenChange(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="border-[#334155] bg-[#0f172a] text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a file</DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4">
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`cursor-pointer rounded-2xl border-2 border-dashed bg-[#0f172a]/50 p-14 text-center transition-colors ${
                  dragActive ? "border-[#3b82f6]" : "border-[#334155] hover:border-[#3b82f6]"
                }`}
              >
                <UploadCloud className="mx-auto mb-3 size-12 text-[#64748b]" />
                <p className="text-sm text-[#94a3b8]">Drag a file here or click to browse</p>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    if (picked) validateAndSetFile(picked);
                  }}
                />
              </div>

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-[#334155] bg-[#1e293b] p-3">
                  <FileTypeIcon mimeType={file.type || "application/octet-stream"} name={file.name} className="size-6" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
                    <p className="text-xs text-[#94a3b8]">{formatFileSize(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setFile(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button disabled={!file} onClick={() => setStep(2)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#1e293b] p-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Enable Secret Sharing</p>
                  <p className="text-xs text-[#94a3b8]">Protect this file with a code and password</p>
                </div>
                <Switch checked={sharingEnabled} onCheckedChange={setSharingEnabled} />
              </div>

              <AnimatePresence initial={false}>
                {sharingEnabled ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="upload-password">Password (4–20 characters)</Label>
                        <div className="relative">
                          <Input
                            id="upload-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            maxLength={20}
                            onChange={(event) => setPassword(event.target.value)}
                            className="border-[#334155] bg-[#0f172a] pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        <div className="flex gap-1 pt-1">
                          {[0, 1, 2, 3].map((index) => (
                            <div
                              key={index}
                              className={`h-1.5 flex-1 rounded-full ${
                                index < strength.segments ? strength.className : "bg-[#334155]"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="upload-confirm-password">Confirm password</Label>
                        <div className="relative">
                          <Input
                            id="upload-confirm-password"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            maxLength={20}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className={`border-[#334155] bg-[#0f172a] pr-9 ${
                              confirmPassword.length > 0 && !passwordsMatch ? "text-red-400 border-red-500" : ""
                            }`}
                          />
                          {passwordsMatch ? (
                            <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-400" />
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="one-time"
                            checked={oneTime}
                            onCheckedChange={(checked) => setOneTime(checked === true)}
                          />
                          <div>
                            <Label htmlFor="one-time" className="cursor-pointer">
                              One-Time Download
                            </Label>
                            <p className="text-xs text-[#94a3b8]">Delete this file after first download. Cannot be undone.</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Expiry</Label>
                        <Select value={expiry} onValueChange={(value) => setExpiry(value as ExpiryValue)}>
                          <SelectTrigger className="border-[#334155] bg-[#0f172a]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPIRY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-3">
                        <p className="text-xs text-[#94a3b8]">Your secret code</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <code className="font-mono text-lg font-bold text-[#3b82f6]">{userSecretCode ?? "—"}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => {
                              if (userSecretCode) void navigator.clipboard.writeText(userSecretCode);
                            }}
                          >
                            <Copy className="size-4" />
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-[#64748b]">Share this code AND the password separately</p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={!canProceedStep2} onClick={() => void startUpload()}>
                  Upload
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4 py-6">
              <div className="flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-[#3b82f6]" />
              </div>
              <p className="text-center text-sm text-[#94a3b8]">Uploading {file?.name}...</p>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-xs text-[#64748b]">{progress}%</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={savedPasswordModal} onOpenChange={() => undefined}>
        <DialogContent
          className="border-amber-500/40 bg-[#1e293b] text-slate-100 sm:max-w-md [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="size-5" />
              SAVE YOUR PASSWORD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#94a3b8]">
              This password will not be shown again. Save it somewhere safe before continuing.
            </p>
            <div className="rounded-lg border border-amber-500/30 bg-[#0f172a] p-4 text-center">
              <code className="break-all font-mono text-2xl font-black text-[#3b82f6]">{savedPasswordValue}</code>
            </div>
            <Button
              variant="outline"
              className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={() => void navigator.clipboard.writeText(savedPasswordValue)}
            >
              <Copy className="mr-2 size-4" />
              Copy password
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm-saved"
                checked={confirmedSaved}
                onCheckedChange={(checked) => setConfirmedSaved(checked === true)}
              />
              <Label htmlFor="confirm-saved" className="cursor-pointer text-sm">
                I have saved this password
              </Label>
            </div>
            <Button disabled={!confirmedSaved} className="w-full" onClick={closeSavedPasswordModal}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
