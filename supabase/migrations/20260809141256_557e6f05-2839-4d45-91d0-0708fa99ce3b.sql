DROP POLICY IF EXISTS "authenticated read settings" ON public.platform_settings;

CREATE POLICY "staff read settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (private.is_staff());

REVOKE SELECT ON public.platform_settings FROM anon;