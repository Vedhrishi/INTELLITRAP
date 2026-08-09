-- 1. Admin helper (authority stays in user_roles via private.has_role)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(auth.uid(), 'admin'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'analyst'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- 2. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS user_secret_code text,
  ADD COLUMN IF NOT EXISTS registration_ip text,
  ADD COLUMN IF NOT EXISTS registration_geo jsonb,
  ADD COLUMN IF NOT EXISTS last_login_ip text,
  ADD COLUMN IF NOT EXISTS last_login_geo jsonb,
  ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login timestamptz;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_secret_code_key
  ON public.profiles(user_secret_code) WHERE user_secret_code IS NOT NULL;

-- 3. File sharing additions
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_password_hash text,
  ADD COLUMN IF NOT EXISTS one_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS uploader_secret_code text,
  ADD COLUMN IF NOT EXISTS share_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_ip text;

CREATE INDEX IF NOT EXISTS idx_files_uploader_secret_code
  ON public.files(uploader_secret_code) WHERE uploader_secret_code IS NOT NULL;

-- 4. VISITORS
CREATE TABLE IF NOT EXISTS public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address text NOT NULL,
  ip_version text,
  city text, region text, country text, country_code text,
  isp text, org text, asn text,
  latitude numeric, longitude numeric, timezone text,
  is_proxy boolean NOT NULL DEFAULT false,
  is_hosting boolean NOT NULL DEFAULT false,
  is_mobile_network boolean NOT NULL DEFAULT false,
  user_agent text, browser text, browser_version text,
  os text, os_version text, device_type text, device_vendor text,
  screen_resolution text, color_depth integer, timezone_offset integer,
  language text, languages text[],
  hardware_concurrency integer, device_memory integer, touch_support boolean,
  mouse_movements integer NOT NULL DEFAULT 0,
  mouse_distance_px integer NOT NULL DEFAULT 0,
  keystrokes integer NOT NULL DEFAULT 0,
  avg_keystroke_interval_ms integer,
  clicks integer NOT NULL DEFAULT 0,
  scroll_events integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  time_on_site_seconds integer NOT NULL DEFAULT 0,
  copy_events integer NOT NULL DEFAULT 0,
  tab_switches integer NOT NULL DEFAULT 0,
  entry_page text, current_page text, referrer text,
  pages_visited text[] NOT NULL DEFAULT '{}',
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  risk_breakdown jsonb NOT NULL DEFAULT '{}',
  risk_signals text[] NOT NULL DEFAULT '{}',
  access_decision text CHECK (access_decision IN ('granted','captcha_mfa','honeypot','blocked')),
  captcha_shown boolean NOT NULL DEFAULT false,
  captcha_passed boolean NOT NULL DEFAULT false,
  otp_shown boolean NOT NULL DEFAULT false,
  otp_passed boolean NOT NULL DEFAULT false,
  challenge_attempts integer NOT NULL DEFAULT 0,
  in_honeypot boolean NOT NULL DEFAULT false,
  honeypot_entered_at timestamptz,
  honeypot_exited_at timestamptz,
  decoy_files_downloaded text[] NOT NULL DEFAULT '{}',
  was_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamptz,
  block_reason text,
  is_online boolean NOT NULL DEFAULT true,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  session_ended_at timestamptz
);
GRANT SELECT ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read visitors" ON public.visitors FOR SELECT TO authenticated USING (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_visitors_ip ON public.visitors(ip_address);
CREATE INDEX IF NOT EXISTS idx_visitors_online ON public.visitors(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_visitors_risk ON public.visitors(risk_level);
CREATE INDEX IF NOT EXISTS idx_visitors_first_seen ON public.visitors(first_seen DESC);

-- 5. VISITOR EVENTS
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  visitor_id text NOT NULL,
  ip_address text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'page_view','page_exit','form_submit',
    'secret_code_attempt','secret_code_success','secret_code_fail',
    'password_attempt','password_success','password_fail',
    'captcha_shown','captcha_passed','captcha_failed',
    'otp_sent','otp_passed','otp_failed',
    'file_download_real','file_download_decoy',
    'honeypot_entered','honeypot_action',
    'blocked','rate_limited','suspicious_behavior',
    'copy_attempt','rapid_clicking'
  )),
  page_path text,
  event_data jsonb NOT NULL DEFAULT '{}',
  risk_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.visitor_events TO authenticated;
GRANT ALL ON public.visitor_events TO service_role;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read visitor events" ON public.visitor_events FOR SELECT TO authenticated USING (public.is_staff());
CREATE INDEX IF NOT EXISTS idx_events_session ON public.visitor_events(session_token);
CREATE INDEX IF NOT EXISTS idx_events_created ON public.visitor_events(created_at DESC);

-- 6. IP INTELLIGENCE
CREATE TABLE IF NOT EXISTS public.ip_intelligence (
  ip_address text PRIMARY KEY,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  total_sessions integer NOT NULL DEFAULT 1,
  total_page_views integer NOT NULL DEFAULT 0,
  total_failed_passwords integer NOT NULL DEFAULT 0,
  total_failed_codes integer NOT NULL DEFAULT 0,
  times_honeypotted integer NOT NULL DEFAULT 0,
  times_blocked integer NOT NULL DEFAULT 0,
  highest_risk_score integer NOT NULL DEFAULT 0,
  current_risk_score integer NOT NULL DEFAULT 0,
  city text, region text, country text, isp text,
  latitude numeric, longitude numeric,
  is_proxy boolean NOT NULL DEFAULT false,
  is_hosting boolean NOT NULL DEFAULT false,
  browsers_used text[] NOT NULL DEFAULT '{}',
  threat_classification text NOT NULL DEFAULT 'unknown'
    CHECK (threat_classification IN ('benign','suspicious','scanner','bot','attacker','unknown')),
  admin_notes text,
  is_whitelisted boolean NOT NULL DEFAULT false,
  is_blacklisted boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.ip_intelligence TO authenticated;
GRANT ALL ON public.ip_intelligence TO service_role;
ALTER TABLE public.ip_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ip intel" ON public.ip_intelligence FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admin writes ip intel" ON public.ip_intelligence FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT UPDATE ON public.ip_intelligence TO authenticated;

-- 7. BLOCKED IPS
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  session_token text,
  visitor_id text,
  block_type text NOT NULL DEFAULT 'auto' CHECK (block_type IN ('auto','manual')),
  trigger_score integer,
  trigger_signals text[],
  reason text NOT NULL,
  geo_snapshot jsonb,
  device_snapshot jsonb,
  admin_alerted boolean NOT NULL DEFAULT false,
  alert_sent_at timestamptz,
  blocked_by_admin uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  unblocked_at timestamptz,
  unblocked_by uuid REFERENCES public.profiles(id)
);
GRANT SELECT, INSERT, UPDATE ON public.blocked_ips TO authenticated;
GRANT ALL ON public.blocked_ips TO service_role;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read blocks" ON public.blocked_ips FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admin inserts blocks" ON public.blocked_ips FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin updates blocks" ON public.blocked_ips FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_blocked_active ON public.blocked_ips(is_active) WHERE is_active = true;

-- 8. DECOY TEMPLATES
CREATE TABLE IF NOT EXISTS public.decoy_file_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  file_name text NOT NULL UNIQUE,
  content text NOT NULL,
  mime_type text NOT NULL,
  lure_score integer NOT NULL DEFAULT 5,
  times_served integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.decoy_file_templates TO authenticated;
GRANT ALL ON public.decoy_file_templates TO service_role;
ALTER TABLE public.decoy_file_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read decoys" ON public.decoy_file_templates FOR SELECT TO authenticated USING (public.is_staff());

-- 9. HONEYPOT ACTIVITY
CREATE TABLE IF NOT EXISTS public.honeypot_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  ip_address text NOT NULL,
  action text NOT NULL,
  decoy_file_name text,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  event_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.honeypot_activity TO authenticated;
GRANT ALL ON public.honeypot_activity TO service_role;
ALTER TABLE public.honeypot_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read honeypot activity" ON public.honeypot_activity FOR SELECT TO authenticated USING (public.is_staff());
CREATE INDEX IF NOT EXISTS idx_honeypot_session ON public.honeypot_activity(session_token);

-- 10. PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin inserts settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin updates settings" ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 11. ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id),
  admin_email text,
  admin_ip text,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin inserts audit" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 12. FILE ACCESS LOG
CREATE TABLE IF NOT EXISTS public.file_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  session_token text,
  ip_address text NOT NULL,
  geo_data jsonb,
  device_data jsonb,
  outcome text CHECK (outcome IN ('success','wrong_password','expired','consumed','blocked')),
  risk_score_at_access integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.file_access_log TO authenticated;
GRANT ALL ON public.file_access_log TO service_role;
ALTER TABLE public.file_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads file access log" ON public.file_access_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_access_log.file_id AND f.owner_id = auth.uid()));
CREATE POLICY "staff read file access log" ON public.file_access_log FOR SELECT TO authenticated USING (public.is_staff());
CREATE INDEX IF NOT EXISTS idx_file_access_file ON public.file_access_log(file_id);

-- 13. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_ips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.honeypot_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_intelligence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_access_log;

-- 14. SETTINGS SEED
INSERT INTO public.platform_settings (key, value) VALUES
  ('registration_enabled','true'),
  ('maintenance_mode','false'),
  ('session_timeout_minutes','30'),
  ('max_file_size_bytes','52428800'),
  ('risk_threshold_medium','31'),
  ('risk_threshold_high','61'),
  ('risk_threshold_critical','81'),
  ('autoblock_enabled','true'),
  ('honeypot_enabled','true'),
  ('visitor_heartbeat_seconds','15'),
  ('offline_after_seconds','60')
ON CONFLICT (key) DO NOTHING;

-- 15. DECOY TEMPLATE SEED
INSERT INTO public.decoy_file_templates (category, file_name, content, mime_type, lure_score) VALUES
('credentials','System_Credentials_Backup.txt',
'=== PRODUCTION CREDENTIALS — CONFIDENTIAL ===
Database Host: db-prod-01.internal
Username: svc_admin
Password: [ROTATED - CONTACT IT SECURITY]
API Key: sk_live_[REVOKED]
NOTICE: Access to this file is monitored.
','text/plain',10),
('employee_records','Employee_Master_List.csv',
'ID,Name,Department,Email
E1001,A. Kumar,Engineering,a.kumar@internal
E1002,P. Sharma,HR,p.sharma@internal
E1003,R. Patel,Finance,r.patel@internal
CONFIDENTIAL — HR USE ONLY
','text/csv',9),
('financial_data','Q4_Financial_Summary.txt',
'INTERNAL — FINANCIAL SUMMARY
Q1 Revenue: 2,45,00,000
Q2 Revenue: 3,12,00,000
Q3 Revenue: 2,98,00,000
Q4 Revenue: 4,23,00,000
DISTRIBUTION RESTRICTED
','text/plain',9),
('customer_database','Customer_Export.json',
'{"record_count":15420,"note":"Contains PII","records":[{"id":"C001","tier":"Enterprise"},{"id":"C002","tier":"Professional"}]}
','application/json',8),
('strategic_plans','Board_Strategy_2025.txt',
'BOARD CONFIDENTIAL — STRATEGIC ROADMAP
Expansion: Southeast Asia Q1-Q2
M&A: 2 targets under evaluation
UNAUTHORIZED DISCLOSURE PROHIBITED
','text/plain',8),
('source_code','Application_Source_Export.txt',
'=== REPOSITORY EXPORT ===
Repository: core-platform
Branch: main / Files: 2847
Contains: /src/ /config/ /migrations/
Deployment keys rotated as of last audit.
','text/plain',7)
ON CONFLICT (file_name) DO NOTHING;