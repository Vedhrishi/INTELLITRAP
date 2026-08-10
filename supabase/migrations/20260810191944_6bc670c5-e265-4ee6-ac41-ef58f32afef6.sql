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