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