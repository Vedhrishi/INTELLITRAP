# IntelliTrap Batch2: replicate / deploy

## 1. Run locally
```bash
npm install
cp .env.example .env     # then fill in the values (step 2)
npm run dev              # http://localhost:3000
```
Requires Node 20.19+ (22 recommended).

## 2. Create the backend (Supabase)
1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste all of `supabase/combined_migrations_for_new_project.sql`, run it once.
3. Project Settings > API: copy the project URL, the publishable (anon) key and the service-role key into `.env`.
   The service-role key is secret: server-only, never commit it.
4. Authentication > Providers > Email: for a quick demo, turn off "Confirm email".
5. Register in the app, then make yourself admin in the SQL editor
   (insert your user id with role `admin` into `public.user_roles`).

## 3. Deploy on Vercel
1. Import the GitHub repo at https://vercel.com/new (framework preset: Other/auto; build command `npm run build`).
2. Add every variable from `.env.example` under Settings > Environment Variables (Production and Preview).
3. Redeploy. (Build uses `package-lock.json`.)

## 4. Paper / ML material
See `ml/REVISION_RESPONSE.md`, `ml/REFERENCES_25.md`, `ml/figures/`.
Regenerate: `python ml/generate_dataset.py && python ml/train.py && python ml/make_revision_assets.py`

## Troubleshooting: confirmation email never arrives
Supabase's built-in mail sender is heavily rate-limited and often blocked or spam-filtered.
- Quick fix for demos: Authentication > Sign In / Providers > Email > turn off **Confirm email**.
- Accounts created *before* that stay unconfirmed. Confirm them (and optionally grant admin) in the SQL editor:
```sql
update auth.users set email_confirmed_at = now()
where email = 'you@example.com' and email_confirmed_at is null;

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict (user_id, role) do nothing;
```
- For real email delivery, configure custom SMTP (e.g. Resend) under Project Settings > Authentication > SMTP.

## Email setup (confirmation + OTP) using Gmail
1. Google Account > Security > turn on 2-Step Verification, then create an **App password** (16 characters).
2. Supabase > Project Settings > Authentication > **SMTP Settings**: enable custom SMTP.
   Host `smtp.gmail.com`, port `465`, username = your Gmail address, password = the app password,
   sender = your Gmail address, sender name `IntelliTrap Batch2`.
3. Supabase > Authentication > Sign In / Providers > Email: turn **Confirm email** ON.
4. Supabase > Authentication > URL Configuration: Site URL = your Vercel URL; add it (`/**`) under Redirect URLs.
5. Vercel > Settings > Environment Variables: add `SMTP_USER` (Gmail address) and `SMTP_PASS` (app password), then redeploy.
   The /share OTP email now uses this SMTP; without it the code falls back to Resend (test sender, owner-only).
