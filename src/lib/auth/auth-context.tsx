import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError, type AuthErrorField } from "./auth-errors";

export type AppRole = "admin" | "analyst" | "user";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  storage_used: number;
  storage_quota: number;
  status: string;
  risk_score: number;
  user_secret_code: string | null;
};

type AuthResult = { error: string | null };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isAnalyst: boolean;
  loading: boolean;
  rolesLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const mounted = useRef(true);

  const loadAccount = useCallback(async (userId: string) => {
    const [profileResult, rolesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, display_name, avatar_url, storage_used, storage_quota, status, risk_score, user_secret_code",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (!mounted.current) return;
    let nextProfile = (profileResult.data as Profile | null) ?? null;

    // Backfill a missing display name from the email prefix (e.g. "ada@x.com" -> "ada").
    if (nextProfile && !nextProfile.display_name) {
      const fallback =
        nextProfile.full_name?.trim() || (nextProfile.email ?? "").split("@")[0] || null;
      if (fallback) {
        nextProfile = { ...nextProfile, display_name: fallback };
        void supabase.from("profiles").update({ display_name: fallback }).eq("id", userId);
      }
    }

    setProfile(nextProfile);
    setRoles(((rolesResult.data ?? []) as { role: AppRole }[]).map((row) => row.role));
    setRolesLoading(false);
  }, []);

  const loadRoles = useCallback(async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!mounted.current) return;
    setRoles(((data ?? []) as { role: AppRole }[]).map((row) => row.role));
    setRolesLoading(false);
  }, []);

  const refreshRoles = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      setRoles([]);
      return;
    }
    await loadRoles(userId);
  }, [loadRoles]);

  useEffect(() => {
    mounted.current = true;

    // Listener FIRST, then getSession — and never call Supabase inside the
    // callback synchronously (deferred with setTimeout) or the session deadlocks.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const userId = nextSession.user.id;
        // Roles are refetched on every identity transition (SIGNED_IN,
        // USER_UPDATED, TOKEN_REFRESHED) so grants apply without a restart.
        setTimeout(() => {
          void loadAccount(userId);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setRolesLoading(false);
      }
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted.current) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void loadAccount(data.session.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => {
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const described = describeAuthError(error.message);
      return { error: described.message, field: described.field };
    }
    return { error: null, field: null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: fullName },
        },
      });
      if (error) {
        const described = describeAuthError(error.message);
        return { error: described.message, field: described.field, needsEmailConfirmation: false };
      }
      // With email confirmation enabled, signUp() returns no session — the user
      // is NOT signed in yet, so the caller must not navigate into the app.
      return { error: null, field: null, needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { error: error ? humanAuthError(error.message) : null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      roles,
      isAdmin: roles.includes("admin"),
      isAnalyst: roles.includes("analyst"),
      loading,
      rolesLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshRoles,
    }),
    [user, session, profile, roles, loading, rolesLoading, signIn, signUp, signOut, resetPassword, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
