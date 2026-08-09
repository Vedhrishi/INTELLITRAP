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