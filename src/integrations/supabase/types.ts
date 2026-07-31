export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_reports: {
        Row: {
          attack_classification: string | null
          confidence: number | null
          created_at: string
          id: string
          indicators: Json
          model: string
          raw_response: Json | null
          recommended_actions: Json
          ref_id: string | null
          scope: string
          summary: string | null
        }
        Insert: {
          attack_classification?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          indicators?: Json
          model: string
          raw_response?: Json | null
          recommended_actions?: Json
          ref_id?: string | null
          scope: string
          summary?: string | null
        }
        Update: {
          attack_classification?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          indicators?: Json
          model?: string
          raw_response?: Json | null
          recommended_actions?: Json
          ref_id?: string | null
          scope?: string
          summary?: string | null
        }
        Relationships: []
      }
      attacker_profiles: {
        Row: {
          fingerprints: Json
          first_seen: string
          geo: Json | null
          highest_severity: string | null
          id: string
          ip_address: unknown
          is_blocked: boolean
          last_seen: string
          notes: string | null
          tactics: string[]
          threat_level: string
          total_events: number
        }
        Insert: {
          fingerprints?: Json
          first_seen?: string
          geo?: Json | null
          highest_severity?: string | null
          id?: string
          ip_address: unknown
          is_blocked?: boolean
          last_seen?: string
          notes?: string | null
          tactics?: string[]
          threat_level?: string
          total_events?: number
        }
        Update: {
          fingerprints?: Json
          first_seen?: string
          geo?: Json | null
          highest_severity?: string | null
          id?: string
          ip_address?: unknown
          is_blocked?: boolean
          last_seen?: string
          notes?: string | null
          tactics?: string[]
          threat_level?: string
          total_events?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip_address: unknown
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      detection_rules: {
        Row: {
          action: string
          created_at: string
          description: string | null
          event_type: string
          hit_count: number
          id: string
          is_enabled: boolean
          name: string
          pattern: string | null
          score_weight: number
          severity: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          description?: string | null
          event_type: string
          hit_count?: number
          id?: string
          is_enabled?: boolean
          name: string
          pattern?: string | null
          score_weight?: number
          severity: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          event_type?: string
          hit_count?: number
          id?: string
          is_enabled?: boolean
          name?: string
          pattern?: string | null
          score_weight?: number
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      file_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          file_id: string
          id: string
          owner_id: string
          permission: string
          revoked_at: string | null
          shared_with_email: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_id: string
          id?: string
          owner_id: string
          permission?: string
          revoked_at?: string | null
          shared_with_email?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_id?: string
          id?: string
          owner_id?: string
          permission?: string
          revoked_at?: string | null
          shared_with_email?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          deleted_at: string | null
          download_count: number
          folder_id: string | null
          id: string
          is_decoy: boolean
          is_encrypted: boolean
          mime_type: string
          name: string
          owner_id: string
          size_bytes: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          folder_id?: string | null
          id?: string
          is_decoy?: boolean
          is_encrypted?: boolean
          mime_type: string
          name: string
          owner_id: string
          size_bytes: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          folder_id?: string | null
          id?: string
          is_decoy?: boolean
          is_encrypted?: boolean
          mime_type?: string
          name?: string
          owner_id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      honeypot_sessions: {
        Row: {
          actions_count: number
          attacker_profile_id: string | null
          decoy_files_touched: string[]
          dwell_seconds: number
          entered_at: string
          exited_at: string | null
          id: string
          keystroke_timeline: Json
          session_id: string | null
          verdict: string | null
        }
        Insert: {
          actions_count?: number
          attacker_profile_id?: string | null
          decoy_files_touched?: string[]
          dwell_seconds?: number
          entered_at?: string
          exited_at?: string | null
          id?: string
          keystroke_timeline?: Json
          session_id?: string | null
          verdict?: string | null
        }
        Update: {
          actions_count?: number
          attacker_profile_id?: string | null
          decoy_files_touched?: string[]
          dwell_seconds?: number
          entered_at?: string
          exited_at?: string | null
          id?: string
          keystroke_timeline?: Json
          session_id?: string | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "honeypot_sessions_attacker_profile_id_fkey"
            columns: ["attacker_profile_id"]
            isOneToOne: false
            referencedRelation: "attacker_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honeypot_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          risk_score: number
          status: string
          storage_quota: number
          storage_used: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          risk_score?: number
          status?: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          risk_score?: number
          status?: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          asn: string | null
          city: string | null
          country: string | null
          device_fingerprint: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          is_tor: boolean
          is_trapped: boolean
          is_vpn: boolean
          last_seen_at: string
          risk_score: number
          session_token: string
          started_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          asn?: string | null
          city?: string | null
          country?: string | null
          device_fingerprint?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_tor?: boolean
          is_trapped?: boolean
          is_vpn?: boolean
          last_seen_at?: string
          risk_score?: number
          session_token: string
          started_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          asn?: string | null
          city?: string | null
          country?: string | null
          device_fingerprint?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_tor?: boolean
          is_trapped?: boolean
          is_vpn?: boolean
          last_seen_at?: string
          risk_score?: number
          session_token?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      threat_events: {
        Row: {
          created_at: string
          description: string | null
          endpoint: string | null
          event_type: string
          http_method: string | null
          id: string
          ip_address: unknown
          payload: Json | null
          rule_id: string | null
          score_delta: number
          session_id: string | null
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          endpoint?: string | null
          event_type: string
          http_method?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json | null
          rule_id?: string | null
          score_delta?: number
          session_id?: string | null
          severity: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          endpoint?: string | null
          event_type?: string
          http_method?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json | null
          rule_id?: string | null
          score_delta?: number
          session_id?: string | null
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threat_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "detection_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threat_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_storage: { Args: { _owner: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "analyst" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst", "user"],
    },
  },
} as const
