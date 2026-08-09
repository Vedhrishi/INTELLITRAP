import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appOrigin } from "@/lib/share/format";
import type { FileRow } from "./types";

function copy(value: string) {
  void navigator.clipboard.writeText(value);
}

export function ShareInfoDialog({
  file,
  userSecretCode,
  open,
  onOpenChange,
  onRevokeAndReupload,
}: {
  file: FileRow | null;
  userSecretCode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevokeAndReupload: (file: FileRow) => void;
}) {
  if (!file) return null;
  const code = userSecretCode ?? file.uploader_secret_code ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#334155] bg-[#0f172a] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share these two things separately</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-[#334155] bg-[#1e293b] p-4 text-center">
            <p className="text-xs font-medium tracking-wide text-[#94a3b8]">YOUR SECRET CODE</p>
            <p className="font-mono text-4xl font-black text-[#3b82f6]">{code}</p>
            <Button variant="outline" className="w-full border-[#334155]" onClick={() => copy(code)}>
              <Copy className="mr-2 size-4" />
              Copy code
            </Button>
            <div className="flex justify-center rounded-md bg-[#0f172a] p-3">
              <QRCodeSVG value={code} size={200} bgColor="#0f172a" fgColor="#3b82f6" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#334155]" />
            <span className="text-xs font-medium text-[#64748b]">AND</span>
            <div className="h-px flex-1 bg-[#334155]" />
          </div>

          <div className="space-y-2 rounded-lg border border-[#334155] bg-[#1e293b] p-4">
            <p className="text-xs font-medium tracking-wide text-[#94a3b8]">FILE PASSWORD</p>
            <p className="text-sm text-[#94a3b8]">The password was shown once when you uploaded.</p>
            <p className="text-sm text-[#94a3b8]">If you&apos;ve lost it, revoke this file and re-upload.</p>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={() => onRevokeAndReupload(file)}
            >
              Revoke &amp; Re-upload
            </Button>
          </div>

          <ol className="list-inside list-decimal space-y-1 text-sm text-[#94a3b8]">
            <li>Share your secret code</li>
            <li>Share the file password via a DIFFERENT channel</li>
            <li>
              They visit <span className="font-mono text-[#3b82f6]">{appOrigin()}/share</span>
            </li>
            <li>They enter your code then the password</li>
            <li>They download the file</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
