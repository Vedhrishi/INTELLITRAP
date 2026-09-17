-- ==== 20260730235010_ed77c336-dead-44fa-aacd-0c05f6b43ab9.sql ====
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  storage_used bigint NOT NULL DEFAULT 0,
  storage_quota bigint NOT NULL DEFAULT 5368709120,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','flagged','quarantined','banned')),
  risk_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins and analysts can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==== 20260730235039_107b2377-5a09-4806-a701-090c2036c3da.sql ====
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- ==== 20260731000643_8c4ae4f4-5df3-4fa1-b617-0ce1da08a23c.sql ====
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- ==== 20260731001023_97fd153f-a541-4db7-a95e-445f72c158cc.sql ====
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum_sha256 text,
  is_encrypted boolean not null default false,
  download_count int not null default 0,
  is_decoy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.file_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shared_with_email text,
  token text unique not null default encode(gen_random_bytes(24),'hex'),
  permission text not null default 'view' check (permission in ('view','download')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_token text not null,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  country text, city text, asn text,
  is_vpn boolean not null default false,
  is_tor boolean not null default false,
  risk_score int not null default 0,
  is_trapped boolean not null default false,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.detection_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  event_type text not null,
  pattern text,
  score_weight int not null default 10,
  severity text not null check (severity in ('low','medium','high','critical')),
  action text not null default 'log' check (action in ('log','challenge','trap','block')),
  is_enabled boolean not null default true,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attacker_profiles (
  id uuid primary key default gen_random_uuid(),
  ip_address inet unique not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_events int not null default 0,
  highest_severity text,
  fingerprints jsonb not null default '[]'::jsonb,
  geo jsonb,
  tactics text[] not null default '{}',
  threat_level text not null default 'low',
  is_blocked boolean not null default false,
  notes text
);

create table public.threat_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  rule_id uuid references public.detection_rules(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  ip_address inet,
  endpoint text,
  http_method text,
  payload jsonb,
  score_delta int not null default 0,
  description text,
  status text not null default 'open'
    check (status in ('open','investigating','resolved','false_positive')),
  created_at timestamptz not null default now()
);

create table public.honeypot_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  attacker_profile_id uuid references public.attacker_profiles(id) on delete set null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  actions_count int not null default 0,
  dwell_seconds int not null default 0,
  decoy_files_touched text[] not null default '{}',
  keystroke_timeline jsonb not null default '[]'::jsonb,
  verdict text
);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('session','attacker','global')),
  ref_id uuid,
  model text not null,
  summary text,
  attack_classification text,
  confidence numeric(4,3),
  indicators jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- Data API grants (RLS still governs row visibility)
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.files to authenticated;
grant select, insert, update, delete on public.file_shares to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.detection_rules to authenticated;
grant select on public.sessions to authenticated;
grant select on public.attacker_profiles to authenticated;
grant select on public.threat_events to authenticated;
grant select on public.honeypot_sessions to authenticated;
grant select on public.ai_reports to authenticated;
grant select, insert on public.audit_log to authenticated;

grant all on public.folders to service_role;
grant all on public.files to service_role;
grant all on public.file_shares to service_role;
grant all on public.notifications to service_role;
grant all on public.sessions to service_role;
grant all on public.detection_rules to service_role;
grant all on public.attacker_profiles to service_role;
grant all on public.threat_events to service_role;
grant all on public.honeypot_sessions to service_role;
grant all on public.ai_reports to service_role;
grant all on public.audit_log to service_role;

alter table public.folders            enable row level security;
alter table public.files              enable row level security;
alter table public.file_shares        enable row level security;
alter table public.notifications      enable row level security;
alter table public.sessions           enable row level security;
alter table public.detection_rules    enable row level security;
alter table public.attacker_profiles  enable row level security;
alter table public.threat_events      enable row level security;
alter table public.honeypot_sessions  enable row level security;
alter table public.ai_reports         enable row level security;
alter table public.audit_log          enable row level security;

create policy "own folders" on public.folders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own files" on public.files
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own shares" on public.file_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own notifications: read" on public.notifications
  for select using (auth.uid() = user_id);

create policy "own notifications: update" on public.notifications
  for update using (auth.uid() = user_id);

create policy "staff read files" on public.files
  for select using (public.has_role(auth.uid(),'admin'));

do $$
declare t text;
begin
  foreach t in array array[
    'sessions','detection_rules','attacker_profiles',
    'threat_events','honeypot_sessions','ai_reports','audit_log'
  ] loop
    execute format(
      'create policy "staff read" on public.%I for select using (
         public.has_role(auth.uid(),''admin'')
         or public.has_role(auth.uid(),''analyst''))', t);
  end loop;
end $$;

create policy "admin writes rules" on public.detection_rules
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create policy "audit insert only" on public.audit_log
  for insert with check (auth.uid() is not null);

create or replace function public.recalc_storage(_owner uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles p set storage_used = coalesce((
    select sum(size_bytes) from public.files
    where owner_id = _owner and deleted_at is null), 0)
  where p.id = _owner;
$$;
revoke all on function public.recalc_storage(uuid) from public, anon, authenticated;

create or replace function public.files_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_storage(coalesce(new.owner_id, old.owner_id));
  return null;
end; $$;
revoke all on function public.files_after_change() from public, anon, authenticated;

create trigger files_storage_sync
  after insert or update or delete on public.files
  for each row execute function public.files_after_change();

create or replace function public.enforce_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare used bigint; quota bigint;
begin
  select storage_used, storage_quota into used, quota
    from public.profiles where id = new.owner_id;
  if used + new.size_bytes > quota then
    raise exception 'STORAGE_QUOTA_EXCEEDED';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_quota() from public, anon, authenticated;

create trigger files_quota_guard
  before insert on public.files
  for each row execute function public.enforce_quota();

create or replace function public.prevent_folder_cycle()
returns trigger language plpgsql set search_path = public as $$
declare cur uuid := new.parent_id;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'FOLDER_CYCLE_DETECTED';
    end if;
    select parent_id into cur from public.folders where id = cur;
  end loop;
  return new;
end; $$;
revoke all on function public.prevent_folder_cycle() from public, anon, authenticated;

create trigger folders_no_cycle
  before insert or update on public.folders
  for each row execute function public.prevent_folder_cycle();

create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

create trigger folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create trigger rules_updated_at before update on public.detection_rules
  for each row execute function public.set_updated_at();

create index idx_files_owner_live on public.files(owner_id, deleted_at);
create index idx_files_folder     on public.files(folder_id);
create index idx_folders_owner    on public.folders(owner_id);
create index idx_folders_parent   on public.folders(parent_id);
create index idx_shares_file      on public.file_shares(file_id);
create index idx_threats_recent   on public.threat_events(created_at desc);
create index idx_threats_session  on public.threat_events(session_id);
create index idx_threats_severity on public.threat_events(severity, created_at desc);
create index idx_sessions_recent  on public.sessions(started_at desc);
create index idx_sessions_user    on public.sessions(user_id);
create index idx_audit_recent     on public.audit_log(created_at desc);
create index idx_notif_user       on public.notifications(user_id, is_read);
create index idx_honeypot_session on public.honeypot_sessions(session_id);

-- ==== 20260731001055_4579499a-126b-4554-bdc8-46ded1612f44.sql ====
create policy "own files read" on storage.objects for select
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files write" on storage.objects for insert
  with check (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files update" on storage.objects for update
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- ==== 20260808134924_2122d059-cf8e-4138-91c3-0363d09e6716.sql ====
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Repoint every policy to the private helper
DROP POLICY IF EXISTS "Admins and analysts can view all profiles" ON public.profiles;
CREATE POLICY "Admins and analysts can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read files" ON public.files;
CREATE POLICY "staff read files" ON public.files FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read" ON public.sessions;
CREATE POLICY "staff read" ON public.sessions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.detection_rules;
CREATE POLICY "staff read" ON public.detection_rules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.attacker_profiles;
CREATE POLICY "staff read" ON public.attacker_profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.threat_events;
CREATE POLICY "staff read" ON public.threat_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.honeypot_sessions;
CREATE POLICY "staff read" ON public.honeypot_sessions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.ai_reports;
CREATE POLICY "staff read" ON public.ai_reports FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "staff read" ON public.audit_log;
CREATE POLICY "staff read" ON public.audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'analyst'));
DROP POLICY IF EXISTS "admin writes rules" ON public.detection_rules;
CREATE POLICY "admin writes rules" ON public.detection_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Share recipients can read shares addressed to them (active only)
CREATE POLICY "recipient reads active share" ON public.file_shares FOR SELECT TO authenticated
  USING (
    shared_with_email IS NOT NULL
    AND lower(shared_with_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Users can read their own session rows; writes stay system-managed
CREATE POLICY "own sessions read" ON public.sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Explicit fail-closed policies for the decoy-files bucket
CREATE POLICY "admins read decoy files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'decoy-files' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "service manages decoy files" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'decoy-files') WITH CHECK (bucket_id = 'decoy-files');

-- ==== 20260809134935_4a0dd9e5-d131-47a2-bb1d-c1cf6662544f.sql ====
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

-- ==== 20260809135019_685058f5-6176-4506-add8-2cbb477816ac.sql ====
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(auth.uid(), 'admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(auth.uid(), 'admin'::public.app_role)
        OR private.has_role(auth.uid(), 'analyst'::public.app_role) $$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC, anon, authenticated;

ALTER POLICY "staff read visitors" ON public.visitors USING (private.is_staff());
ALTER POLICY "staff read visitor events" ON public.visitor_events USING (private.is_staff());
ALTER POLICY "staff read ip intel" ON public.ip_intelligence USING (private.is_staff());
ALTER POLICY "admin writes ip intel" ON public.ip_intelligence USING (private.is_admin()) WITH CHECK (private.is_admin());
ALTER POLICY "staff read blocks" ON public.blocked_ips USING (private.is_staff());
ALTER POLICY "admin inserts blocks" ON public.blocked_ips WITH CHECK (private.is_admin());
ALTER POLICY "admin updates blocks" ON public.blocked_ips USING (private.is_admin()) WITH CHECK (private.is_admin());
ALTER POLICY "staff read decoys" ON public.decoy_file_templates USING (private.is_staff());
ALTER POLICY "staff read honeypot activity" ON public.honeypot_activity USING (private.is_staff());
ALTER POLICY "admin inserts settings" ON public.platform_settings WITH CHECK (private.is_admin());
ALTER POLICY "admin updates settings" ON public.platform_settings USING (private.is_admin()) WITH CHECK (private.is_admin());
ALTER POLICY "admin reads audit" ON public.admin_audit_log USING (private.is_admin());
ALTER POLICY "admin inserts audit" ON public.admin_audit_log WITH CHECK (private.is_admin());
ALTER POLICY "staff read file access log" ON public.file_access_log USING (private.is_staff());

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_staff();

-- ==== 20260809135835_4e35af3e-99b8-4458-aa2b-e08170204b4a.sql ====
ALTER TABLE public.visitors REPLICA IDENTITY FULL;
ALTER TABLE public.visitor_events REPLICA IDENTITY FULL;
ALTER TABLE public.blocked_ips REPLICA IDENTITY FULL;
ALTER TABLE public.honeypot_activity REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.visitors; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_ips; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.honeypot_activity; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ==== 20260809141256_557e6f05-2839-4d45-91d0-0708fa99ce3b.sql ====
DROP POLICY IF EXISTS "authenticated read settings" ON public.platform_settings;

CREATE POLICY "staff read settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (private.is_staff());

REVOKE SELECT ON public.platform_settings FROM anon;

-- ==== 20260809152539_abe2d0a5-10ff-4317-92f3-4f2165656ba7.sql ====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_files integer NOT NULL DEFAULT 100;

ALTER TABLE public.profiles ALTER COLUMN storage_quota SET DEFAULT 1073741824;
UPDATE public.profiles SET storage_quota = 1073741824 WHERE storage_quota < 1073741824;

UPDATE public.platform_settings SET value = '1073741824' WHERE key = 'max_file_size_bytes';

INSERT INTO public.platform_settings (key, value) VALUES
  ('user_storage_quota_bytes','1073741824'),
  ('user_max_files','100'),
  ('total_pool_bytes','10737418240')
ON CONFLICT (key) DO NOTHING;

-- ==== 20260810191944_6bc670c5-e265-4ee6-ac41-ef58f32afef6.sql ====
-- 1. Monitoring telemetry readable by any signed-in user (dashboard/map/visitors)
DROP POLICY IF EXISTS "staff read visitors" ON public.visitors;
CREATE POLICY "authenticated read visitors" ON public.visitors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff read visitor events" ON public.visitor_events;
CREATE POLICY "authenticated read visitor events" ON public.visitor_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff read ip intel" ON public.ip_intelligence;
CREATE POLICY "authenticated read ip intel" ON public.ip_intelligence FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff read honeypot activity" ON public.honeypot_activity;
CREATE POLICY "authenticated read honeypot activity" ON public.honeypot_activity FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff read blocks" ON public.blocked_ips;
CREATE POLICY "authenticated read blocks" ON public.blocked_ips FOR SELECT TO authenticated USING (true);

-- 2. Always issue a sharing secret code at signup
CREATE OR REPLACE FUNCTION public.generate_secret_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_secret_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_secret_code() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_secret_code() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_secret_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    public.generate_secret_code()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Enforce the per-user file count cap in the database, alongside the byte quota
CREATE OR REPLACE FUNCTION public.enforce_file_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count bigint;
  cap int;
BEGIN
  SELECT max_files INTO cap FROM public.profiles WHERE id = NEW.owner_id;
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO current_count
    FROM public.files
    WHERE owner_id = NEW.owner_id AND deleted_at IS NULL;
  IF current_count >= cap THEN
    RAISE EXCEPTION 'FILE_LIMIT_EXCEEDED';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_file_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_file_count() FROM anon, authenticated;

DROP TRIGGER IF EXISTS files_count_guard ON public.files;
CREATE TRIGGER files_count_guard
BEFORE INSERT ON public.files
FOR EACH ROW EXECUTE FUNCTION public.enforce_file_count();

-- ==== 20260812165200_adeaee1a-7b09-4336-be22-ef0ca231db90.sql ====
-- Skipped: one-off admin grant for a user_id from the old project (487fcdb2-...)
-- that doesn't exist in this project's auth.users. Fully reverted below anyway
-- (20260812170520), so both statements are dropped as a no-op pair.

-- ==== 20260812165413_a5bc00c1-4c1a-4d8c-b7f2-92ecb5389d23.sql ====
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;

-- ==== 20260812170520_7b6b02dc-37a4-477a-a8a1-9b5f112aca7a.sql ====
-- Skipped: reverts the no-op admin grant above; nothing to do.

-- ==== 20260826182315_b6b497f8-3bce-4b3e-a2af-edb8501a96e3.sql ====
CREATE TABLE public.auth_failure_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  masked_email text,
  reason text NOT NULL,
  flow text NOT NULL,
  ip_address text,
  country text,
  city text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_failure_log TO authenticated;
GRANT ALL ON public.auth_failure_log TO service_role;

ALTER TABLE public.auth_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read auth failures"
  ON public.auth_failure_log
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

CREATE INDEX auth_failure_log_created_at_idx ON public.auth_failure_log (created_at DESC);
CREATE INDEX auth_failure_log_ip_created_idx ON public.auth_failure_log (ip_address, created_at DESC);

-- ==== 20260914110410_2e6f5318-68aa-4b28-bdb7-1005be73090a.sql ====
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS files_share_token_key
  ON public.files (share_token) WHERE share_token IS NOT NULL;

UPDATE public.files f
   SET uploader_secret_code = p.user_secret_code
  FROM public.profiles p
 WHERE p.id = f.owner_id
   AND f.uploader_secret_code IS NULL
   AND p.user_secret_code IS NOT NULL;

-- ==== 20260917000000_otp_email_verification.sql ====
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS otp_code_hash text,
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;

