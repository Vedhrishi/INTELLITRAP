import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FileRow } from "./types";

export function useFiles(userId: string | undefined) {
  return useQuery({
    queryKey: ["secure-files", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<FileRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUserSecretCode(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-secret-code", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_secret_code")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.user_secret_code ?? null;
    },
  });
}
