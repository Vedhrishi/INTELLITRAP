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
