ALTER TABLE public.files ADD COLUMN IF NOT EXISTS share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS files_share_token_key
  ON public.files (share_token) WHERE share_token IS NOT NULL;

UPDATE public.files f
   SET uploader_secret_code = p.user_secret_code
  FROM public.profiles p
 WHERE p.id = f.owner_id
   AND f.uploader_secret_code IS NULL
   AND p.user_secret_code IS NOT NULL;