import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Key, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/primitives/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { appOrigin, generateSecretCode, toIST } from "@/lib/share/format";

const title = "Settings";
const description = "Manage your profile, appearance, and file sharing secret code.";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type SettingsProfile = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  user_secret_code: string | null;
};

function useSettingsProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, email, role, created_at, user_secret_code")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error("Could not load your profile");
      setLoading(false);
      return;
    }
    setProfile(data as SettingsProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="secret-code">Secret Code</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="secret-code" className="mt-6">
          <SecretCodeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { profile, loading, refresh } = useSettingsProfile();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? profile?.full_name ?? "");
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Could not update your name");
      return;
    }
    toast.success("Profile updated");
    void refresh();
  };

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Profile not found.</p>;
  }

  return (
    <div className="glass-elevated max-w-md space-y-4 rounded-2xl p-6">
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <p className="text-sm text-muted-foreground">{profile.email ?? "—"}</p>
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <p className="text-sm capitalize text-muted-foreground">{profile.role}</p>
      </div>
      <div className="space-y-1.5">
        <Label>Member since</Label>
        <p className="text-sm text-muted-foreground">{toIST(profile.created_at, "dd MMM yyyy")}</p>
      </div>
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="glass-elevated flex max-w-md items-center justify-between rounded-2xl p-6">
      <div>
        <p className="font-medium text-foreground">Theme</p>
        <p className="text-sm text-muted-foreground">Toggle between light and dark mode.</p>
      </div>
      <ThemeToggle />
    </div>
  );
}

function SecretCodeTab() {
  const { profile, loading, refresh } = useSettingsProfile();
  const [ensuring, setEnsuring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!loading && profile && !profile.user_secret_code && !ensuring) {
      setEnsuring(true);
      const code = generateSecretCode();
      void supabase
        .from("profiles")
        .update({ user_secret_code: code })
        .eq("id", profile.id)
        .then(({ error }) => {
          if (error) {
            if (import.meta.env.DEV) console.error(error);
            toast.error("Could not generate your secret code");
          } else {
            void refresh();
          }
          setEnsuring(false);
        });
    }
  }, [loading, profile, ensuring, refresh]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (loading || ensuring || !profile?.user_secret_code) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  const code = profile.user_secret_code;
  const shareUrl = `${appOrigin()}/share`;

  const copyCode = () => {
    void navigator.clipboard.writeText(code).then(() => setCopied(true));
  };

  const regenerate = async () => {
    if (confirmText !== "REGENERATE") return;
    setRegenerating(true);
    const newCode = generateSecretCode();
    const [profileResult, filesResult] = await Promise.all([
      supabase.from("profiles").update({ user_secret_code: newCode }).eq("id", profile.id),
      supabase
        .from("files")
        .update({ uploader_secret_code: newCode })
        .eq("owner_id", profile.id)
        .eq("consumed", false),
    ]);
    setRegenerating(false);
    if (profileResult.error || filesResult.error) {
      if (import.meta.env.DEV) console.error(profileResult.error ?? filesResult.error);
      toast.error("Could not regenerate your code");
      return;
    }
    setConfirmText("");
    toast.success("New code generated!");
    void refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="glass-elevated rounded-2xl p-8 text-center">
        <Key className="mx-auto h-8 w-8 text-[#3b82f6]" />
        <h2 className="mt-3 text-xl font-bold text-foreground">Your File Sharing Code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recipients enter this on /share to find your files
        </p>

        <div className="mt-6 rounded-2xl border border-[#334155] bg-[#0f172a] px-6 py-8">
          <p className="break-all font-mono text-5xl font-black tracking-[0.2em] text-[#3b82f6]">
            {code}
          </p>
        </div>

        <Button
          className="mt-4 w-full"
          variant={copied ? "secondary" : "default"}
          onClick={copyCode}
        >
          {copied ? <span className="text-green-500">✓ Copied!</span> : "Copy code"}
        </Button>

        <div className="mt-6 flex justify-center">
          <div className="rounded-xl bg-[#0f172a] p-4">
            <QRCodeSVG value={shareUrl} size={200} bgColor="#0f172a" fgColor="#3b82f6" />
          </div>
        </div>

        <ol className="mt-6 space-y-1.5 text-left text-sm text-muted-foreground">
          <li>1. Share this code with someone you trust.</li>
          <li>
            2. They visit <span className="font-mono text-foreground">{shareUrl}</span>.
          </li>
          <li>3. They enter your secret code to find your files.</li>
          <li>4. Approve access from your dashboard when they request a file.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-foreground">Regenerate Secret Code</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently breaks ALL existing file shares. Anyone with your old code loses access
          immediately.
        </p>
        <Input
          className="mt-4"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder='Type "REGENERATE" to confirm'
        />
        <Button
          variant="destructive"
          className="mt-3 w-full"
          disabled={confirmText !== "REGENERATE" || regenerating}
          onClick={() => void regenerate()}
        >
          {regenerating ? "Generating..." : "Generate New Code"}
        </Button>
      </div>
    </div>
  );
}
