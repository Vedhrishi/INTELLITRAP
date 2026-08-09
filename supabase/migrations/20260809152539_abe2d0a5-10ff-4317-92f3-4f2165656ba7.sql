ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_files integer NOT NULL DEFAULT 100;

ALTER TABLE public.profiles ALTER COLUMN storage_quota SET DEFAULT 1073741824;
UPDATE public.profiles SET storage_quota = 1073741824 WHERE storage_quota < 1073741824;

UPDATE public.platform_settings SET value = '1073741824' WHERE key = 'max_file_size_bytes';

INSERT INTO public.platform_settings (key, value) VALUES
  ('user_storage_quota_bytes','1073741824'),
  ('user_max_files','100'),
  ('total_pool_bytes','10737418240')
ON CONFLICT (key) DO NOTHING;