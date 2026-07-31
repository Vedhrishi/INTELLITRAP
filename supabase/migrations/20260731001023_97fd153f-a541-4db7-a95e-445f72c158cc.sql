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