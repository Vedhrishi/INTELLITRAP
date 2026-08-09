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