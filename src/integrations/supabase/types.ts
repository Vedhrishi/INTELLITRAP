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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: string | null
          admin_ip: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_id?: string | null
          admin_ip?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_id?: string | null
          admin_ip?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      blocked_ips: {
        Row: {
          admin_alerted: boolean
          alert_sent_at: string | null
          block_type: string
          blocked_at: string
          blocked_by_admin: string | null
          device_snapshot: Json | null
          geo_snapshot: Json | null
          id: string
          ip_address: string
          is_active: boolean
          reason: string
          session_token: string | null
          trigger_score: number | null
          trigger_signals: string[] | null
          unblocked_at: string | null
          unblocked_by: string | null
          visitor_id: string | null
        }
        Insert: {
          admin_alerted?: boolean
          alert_sent_at?: string | null
          block_type?: string
          blocked_at?: string
          blocked_by_admin?: string | null
          device_snapshot?: Json | null
          geo_snapshot?: Json | null
          id?: string
          ip_address: string
          is_active?: boolean
          reason: string
          session_token?: string | null
          trigger_score?: number | null
          trigger_signals?: string[] | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          visitor_id?: string | null
        }
        Update: {
          admin_alerted?: boolean
          alert_sent_at?: string | null
          block_type?: string
          blocked_at?: string
          blocked_by_admin?: string | null
          device_snapshot?: Json | null
          geo_snapshot?: Json | null
          id?: string
          ip_address?: string
          is_active?: boolean
          reason?: string
          session_token?: string | null
          trigger_score?: number | null
          trigger_signals?: string[] | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_ips_blocked_by_admin_fkey"
            columns: ["blocked_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_ips_unblocked_by_fkey"
            columns: ["unblocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decoy_file_templates: {
        Row: {
          category: string
          content: string
          file_name: string
          id: string
          lure_score: number
          mime_type: string
          times_served: number
        }
        Insert: {
          category: string
          content: string
          file_name: string
          id?: string
          lure_score?: number
          mime_type: string
          times_served?: number
        }
        Update: {
          category?: string
          content?: string
          file_name?: string
          id?: string
          lure_score?: number
          mime_type?: string
          times_served?: number
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
      file_access_log: {
        Row: {
          created_at: string
          device_data: Json | null
          file_id: string | null
          geo_data: Json | null
          id: string
          ip_address: string
          outcome: string | null
          risk_score_at_access: number | null
          session_token: string | null
        }
        Insert: {
          created_at?: string
          device_data?: Json | null
          file_id?: string | null
          geo_data?: Json | null
          id?: string
          ip_address: string
          outcome?: string | null
          risk_score_at_access?: number | null
          session_token?: string | null
        }
        Update: {
          created_at?: string
          device_data?: Json | null
          file_id?: string | null
          geo_data?: Json | null
          id?: string
          ip_address?: string
          outcome?: string | null
          risk_score_at_access?: number | null
          session_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_access_log_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
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
          consumed: boolean
          created_at: string
          deleted_at: string | null
          download_count: number
          expires_at: string | null
          file_password_hash: string | null
          folder_id: string | null
          id: string
          is_decoy: boolean
          is_encrypted: boolean
          is_shared: boolean
          mime_type: string
          name: string
          one_time: boolean
          owner_id: string
          share_revoked: boolean
          size_bytes: number
          storage_path: string
          updated_at: string
          upload_ip: string | null
          uploader_secret_code: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          consumed?: boolean
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          expires_at?: string | null
          file_password_hash?: string | null
          folder_id?: string | null
          id?: string
          is_decoy?: boolean
          is_encrypted?: boolean
          is_shared?: boolean
          mime_type: string
          name: string
          one_time?: boolean
          owner_id: string
          share_revoked?: boolean
          size_bytes: number
          storage_path: string
          updated_at?: string
          upload_ip?: string | null
          uploader_secret_code?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          consumed?: boolean
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          expires_at?: string | null
          file_password_hash?: string | null
          folder_id?: string | null
          id?: string
          is_decoy?: boolean
          is_encrypted?: boolean
          is_shared?: boolean
          mime_type?: string
          name?: string
          one_time?: boolean
          owner_id?: string
          share_revoked?: boolean
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          upload_ip?: string | null
          uploader_secret_code?: string | null
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
      honeypot_activity: {
        Row: {
          action: string
          created_at: string
          decoy_file_name: string | null
          event_data: Json
          id: string
          ip_address: string
          session_token: string
          time_spent_seconds: number
        }
        Insert: {
          action: string
          created_at?: string
          decoy_file_name?: string | null
          event_data?: Json
          id?: string
          ip_address: string
          session_token: string
          time_spent_seconds?: number
        }
        Update: {
          action?: string
          created_at?: string
          decoy_file_name?: string | null
          event_data?: Json
          id?: string
          ip_address?: string
          session_token?: string
          time_spent_seconds?: number
        }
        Relationships: []
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
      ip_intelligence: {
        Row: {
          admin_notes: string | null
          browsers_used: string[]
          city: string | null
          country: string | null
          current_risk_score: number
          first_seen: string
          highest_risk_score: number
          ip_address: string
          is_blacklisted: boolean
          is_hosting: boolean
          is_proxy: boolean
          is_whitelisted: boolean
          isp: string | null
          last_seen: string
          latitude: number | null
          longitude: number | null
          region: string | null
          threat_classification: string
          times_blocked: number
          times_honeypotted: number
          total_failed_codes: number
          total_failed_passwords: number
          total_page_views: number
          total_sessions: number
        }
        Insert: {
          admin_notes?: string | null
          browsers_used?: string[]
          city?: string | null
          country?: string | null
          current_risk_score?: number
          first_seen?: string
          highest_risk_score?: number
          ip_address: string
          is_blacklisted?: boolean
          is_hosting?: boolean
          is_proxy?: boolean
          is_whitelisted?: boolean
          isp?: string | null
          last_seen?: string
          latitude?: number | null
          longitude?: number | null
          region?: string | null
          threat_classification?: string
          times_blocked?: number
          times_honeypotted?: number
          total_failed_codes?: number
          total_failed_passwords?: number
          total_page_views?: number
          total_sessions?: number
        }
        Update: {
          admin_notes?: string | null
          browsers_used?: string[]
          city?: string | null
          country?: string | null
          current_risk_score?: number
          first_seen?: string
          highest_risk_score?: number
          ip_address?: string
          is_blacklisted?: boolean
          is_hosting?: boolean
          is_proxy?: boolean
          is_whitelisted?: boolean
          isp?: string | null
          last_seen?: string
          latitude?: number | null
          longitude?: number | null
          region?: string | null
          threat_classification?: string
          times_blocked?: number
          times_honeypotted?: number
          total_failed_codes?: number
          total_failed_passwords?: number
          total_page_views?: number
          total_sessions?: number
        }
        Relationships: []
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
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          last_login_geo: Json | null
          last_login_ip: string | null
          login_count: number
          max_files: number
          registration_geo: Json | null
          registration_ip: string | null
          risk_score: number
          role: string
          setup_complete: boolean
          status: string
          storage_quota: number
          storage_used: number
          updated_at: string
          user_secret_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          last_login_geo?: Json | null
          last_login_ip?: string | null
          login_count?: number
          max_files?: number
          registration_geo?: Json | null
          registration_ip?: string | null
          risk_score?: number
          role?: string
          setup_complete?: boolean
          status?: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
          user_secret_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          last_login_geo?: Json | null
          last_login_ip?: string | null
          login_count?: number
          max_files?: number
          registration_geo?: Json | null
          registration_ip?: string | null
          risk_score?: number
          role?: string
          setup_complete?: boolean
          status?: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
          user_secret_code?: string | null
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
      visitor_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          ip_address: string
          page_path: string | null
          risk_delta: number
          session_token: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          ip_address: string
          page_path?: string | null
          risk_delta?: number
          session_token: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          ip_address?: string
          page_path?: string | null
          risk_delta?: number
          session_token?: string
          visitor_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          access_decision: string | null
          asn: string | null
          avg_keystroke_interval_ms: number | null
          block_reason: string | null
          blocked_at: string | null
          browser: string | null
          browser_version: string | null
          captcha_passed: boolean
          captcha_shown: boolean
          challenge_attempts: number
          city: string | null
          clicks: number
          color_depth: number | null
          copy_events: number
          country: string | null
          country_code: string | null
          current_page: string | null
          decoy_files_downloaded: string[]
          device_memory: number | null
          device_type: string | null
          device_vendor: string | null
          entry_page: string | null
          first_seen: string
          hardware_concurrency: number | null
          honeypot_entered_at: string | null
          honeypot_exited_at: string | null
          id: string
          in_honeypot: boolean
          ip_address: string
          ip_version: string | null
          is_hosting: boolean
          is_mobile_network: boolean
          is_online: boolean
          is_proxy: boolean
          isp: string | null
          keystrokes: number
          language: string | null
          languages: string[] | null
          last_heartbeat: string
          latitude: number | null
          longitude: number | null
          mouse_distance_px: number
          mouse_movements: number
          org: string | null
          os: string | null
          os_version: string | null
          otp_passed: boolean
          otp_shown: boolean
          page_views: number
          pages_visited: string[]
          referrer: string | null
          region: string | null
          risk_breakdown: Json
          risk_level: string
          risk_score: number
          risk_signals: string[]
          screen_resolution: string | null
          scroll_events: number
          session_ended_at: string | null
          session_token: string
          tab_switches: number
          time_on_site_seconds: number
          timezone: string | null
          timezone_offset: number | null
          touch_support: boolean | null
          user_agent: string | null
          visitor_id: string
          was_blocked: boolean
        }
        Insert: {
          access_decision?: string | null
          asn?: string | null
          avg_keystroke_interval_ms?: number | null
          block_reason?: string | null
          blocked_at?: string | null
          browser?: string | null
          browser_version?: string | null
          captcha_passed?: boolean
          captcha_shown?: boolean
          challenge_attempts?: number
          city?: string | null
          clicks?: number
          color_depth?: number | null
          copy_events?: number
          country?: string | null
          country_code?: string | null
          current_page?: string | null
          decoy_files_downloaded?: string[]
          device_memory?: number | null
          device_type?: string | null
          device_vendor?: string | null
          entry_page?: string | null
          first_seen?: string
          hardware_concurrency?: number | null
          honeypot_entered_at?: string | null
          honeypot_exited_at?: string | null
          id?: string
          in_honeypot?: boolean
          ip_address: string
          ip_version?: string | null
          is_hosting?: boolean
          is_mobile_network?: boolean
          is_online?: boolean
          is_proxy?: boolean
          isp?: string | null
          keystrokes?: number
          language?: string | null
          languages?: string[] | null
          last_heartbeat?: string
          latitude?: number | null
          longitude?: number | null
          mouse_distance_px?: number
          mouse_movements?: number
          org?: string | null
          os?: string | null
          os_version?: string | null
          otp_passed?: boolean
          otp_shown?: boolean
          page_views?: number
          pages_visited?: string[]
          referrer?: string | null
          region?: string | null
          risk_breakdown?: Json
          risk_level?: string
          risk_score?: number
          risk_signals?: string[]
          screen_resolution?: string | null
          scroll_events?: number
          session_ended_at?: string | null
          session_token: string
          tab_switches?: number
          time_on_site_seconds?: number
          timezone?: string | null
          timezone_offset?: number | null
          touch_support?: boolean | null
          user_agent?: string | null
          visitor_id: string
          was_blocked?: boolean
        }
        Update: {
          access_decision?: string | null
          asn?: string | null
          avg_keystroke_interval_ms?: number | null
          block_reason?: string | null
          blocked_at?: string | null
          browser?: string | null
          browser_version?: string | null
          captcha_passed?: boolean
          captcha_shown?: boolean
          challenge_attempts?: number
          city?: string | null
          clicks?: number
          color_depth?: number | null
          copy_events?: number
          country?: string | null
          country_code?: string | null
          current_page?: string | null
          decoy_files_downloaded?: string[]
          device_memory?: number | null
          device_type?: string | null
          device_vendor?: string | null
          entry_page?: string | null
          first_seen?: string
          hardware_concurrency?: number | null
          honeypot_entered_at?: string | null
          honeypot_exited_at?: string | null
          id?: string
          in_honeypot?: boolean
          ip_address?: string
          ip_version?: string | null
          is_hosting?: boolean
          is_mobile_network?: boolean
          is_online?: boolean
          is_proxy?: boolean
          isp?: string | null
          keystrokes?: number
          language?: string | null
          languages?: string[] | null
          last_heartbeat?: string
          latitude?: number | null
          longitude?: number | null
          mouse_distance_px?: number
          mouse_movements?: number
          org?: string | null
          os?: string | null
          os_version?: string | null
          otp_passed?: boolean
          otp_shown?: boolean
          page_views?: number
          pages_visited?: string[]
          referrer?: string | null
          region?: string | null
          risk_breakdown?: Json
          risk_level?: string
          risk_score?: number
          risk_signals?: string[]
          screen_resolution?: string | null
          scroll_events?: number
          session_ended_at?: string | null
          session_token?: string
          tab_switches?: number
          time_on_site_seconds?: number
          timezone?: string | null
          timezone_offset?: number | null
          touch_support?: boolean | null
          user_agent?: string | null
          visitor_id?: string
          was_blocked?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
