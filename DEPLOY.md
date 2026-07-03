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

## M10: reminders engine

Built. Needs, on top of the section 3 env vars (both locally and on Vercel):

- `TELEGRAM_BOT_TOKEN` (from @BotFather)
- `CRON_SECRET` (any long random string; also used in the cron URL)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (generate once with `npx web-push generate-vapid-keys`)

Run `supabase/migrations/0007_reminders.sql` in the SQL editor once.

cron-job.org: create a job hitting
`https://YOUR-APP.vercel.app/api/cron/reminders?secret=YOUR_CRON_SECRET`
every 5 minutes (GET). The route is idempotent: overlapping runs can never
double-send (unique send-log insert gates every send).

Each user connects channels on the Reminders page: Connect Telegram
(open the bot, tap Start, then "complete the link") and/or Enable push
(on iPhone: install the app to the home screen first, then enable from
inside it). "Send me a test now" verifies the pipes.
