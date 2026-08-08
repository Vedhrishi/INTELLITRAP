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