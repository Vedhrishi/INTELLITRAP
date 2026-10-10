-- Restrict visitor telemetry (IPs, locations, blocks) to admins/analysts.
-- Replaces the demo-friendly "any signed-in user can read" policies. Non-staff accounts will see
-- empty dashboards. Rollback: re-create the "authenticated read ..." policies from migration 20260810191944.

DROP POLICY IF EXISTS "authenticated read visitors" ON public.visitors;
CREATE POLICY "staff read visitors" ON public.visitors FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "authenticated read visitor events" ON public.visitor_events;
CREATE POLICY "staff read visitor events" ON public.visitor_events FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "authenticated read ip intel" ON public.ip_intelligence;
CREATE POLICY "staff read ip intel" ON public.ip_intelligence FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "authenticated read honeypot activity" ON public.honeypot_activity;
CREATE POLICY "staff read honeypot activity" ON public.honeypot_activity FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "authenticated read blocks" ON public.blocked_ips;
CREATE POLICY "staff read blocks" ON public.blocked_ips FOR SELECT TO authenticated USING (private.is_staff());
