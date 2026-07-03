# Deploy to Vercel (M9)

The app is a PWA and is ready to deploy. Do these steps in order.

## 1. Rotate the leaked keys first (important)

The original Supabase secret key and Gemini key were pasted in chat early on.
Rotate both before going live, then update `.env.local` locally too.

- Supabase: Project Settings, API, rotate the secret (`service_role` / `sb_secret`) key.
  The publishable/anon key can stay.
- Gemini: Google AI Studio, delete the old API key, create a new one.

## 2. Push the repo to GitHub

The project is a git repo. Create a private GitHub repo and push `main`
(or `master`). Do not commit `.env.local` (it is gitignored).

## 3. Create the Vercel project

- vercel.com, New Project, import the GitHub repo. Framework autodetects Next.js.
- Add Environment Variables (Production and Preview), the same names as
  `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SECRET_KEY` (the rotated one)
  - `GEMINI_API_KEY` (the rotated one)
  - optional: `GEMINI_MODEL`
- Deploy.

## 4. Point Supabase auth at the live URL

In Supabase, Authentication, URL Configuration:
- Site URL: the Vercel URL (e.g. `https://your-app.vercel.app`)
- Redirect URLs: add `https://your-app.vercel.app/auth/callback`

## 5. Confirm the database is migrated

All migrations in `supabase/migrations/` must have been run in this project's
SQL editor (0001 through 0006). If the live app uses the same Supabase project
you have been testing on, they are already applied.

## 6. Verify live

- Open the URL, sign in, load Today, run a coach review (proves the Gemini key
  and the coach-knowledge file bundling work in the serverless functions).
- Install it: iPhone Safari, Share, Add to Home Screen. Desktop Chrome, the
  install icon in the address bar. It opens standalone with the Life OS icon.
- Offline check: open the app, turn off wifi, navigate; you should get the
  offline page, not a browser error.

## Note for a new user (your girlfriend)

1. Open the app URL on her phone, tap Sign up, use her own email and password.
2. She is taken straight into onboarding: a few minutes of questions, then the
   app proposes her own systems and goals. She edits and saves.
3. Add to Home Screen (Safari share sheet) so it behaves like an app.
4. To link accounts: on the Partner page, one of you enters the other's signup
   email and sends a request; the other accepts on their Partner page.

## Fast-follow, not part of this deploy

Phone push notifications (M10): cron-job.org pinging an API route, Telegram bot
as the reliable channel, Web Push where iOS allows it. The service worker
already has the push and notificationclick handlers in place as the seam.
