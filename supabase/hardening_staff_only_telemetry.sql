-- OPTIONAL hardening: restrict visitor telemetry to admins/analysts.
-- Migration 20260810191944 made these tables readable by ANY signed-in user so a
-- fresh demo account sees a populated dashboard. In production that exposes visitor
-- IPs, locations and block lists to every registered user. Run this in the Supabase
-- SQL editor to restore staff-only reads. Side effect: non-staff accounts will see
-- empty dashboards. To undo, re-run the 'authenticated read ...' policies from that migration.

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
