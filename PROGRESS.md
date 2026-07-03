# Build Progress

Quick state of the build so we resume fast. The full plan is MASTER-BUILD-SPEC.md (section 15 milestones).

## Done and working
- Phases 1-3: auth, four tables + RLS, editable systems engine, history, Gemini coach (gemini-2.5-flash, retry + fallback).
- All five playbooks real and clean: Diet, Sleep, Exercise, Mind (vision, gems, reframe library with pin + categories), Morning & schedule (Eisenhower matrix, personal only).
- Today v2.1 (M1 complete): calm single column; energy headline; gem + one code-derived dynamic focus line; five collapsed rows in day order (Sleep, Schedule, Training, Diet, Mind); diet quick-entry steppers prefilled; Mind journal (intention + reflection + Private + Save together); compact Goals quarter card; Review and Ask as modals; day navigation; time-aware in-app nudges rewired.
- Daily coach review grounded in code-computed numbers (never invents them).

## Milestones (MASTER-BUILD-SPEC.md section 15)
- M1 Today cleanup to spec: DONE.
- M2 Goals/Projects (goals table + full year view): DONE. Requires running
  supabase/migrations/0003_goals.sql in the Supabase SQL editor once; it also
  migrates the old jsonb goals across and strips them from coaching_prefs.
- M3 Weekly review: DONE. Requires running supabase/migrations/0004_reviews.sql
  once. /weekly page: code-computed 7-day stats (adherence + autopilot/willpower
  labels, energy-to-habit correlations, sleep step, goal movement vs the prior
  stored review), coach narration, keepable in the reviews table, review-day
  setting (default Sunday), Today card highlighted on the chosen day.
- M4 Trends + monthly review + pattern-finding: DONE. /trends is a configurable
  picker: a metric catalog (energy, wake, bed, sleep duration, overall
  adherence, per-system rolling adherence, calories, protein, water, weight,
  and goal-progress trajectories from stored review snapshots). User adds /
  removes / reorders trends; selection persists in coaching_prefs.trends.metrics.
  Charts are pure-SVG with inline styling (stroke/layout never depend on the CSS
  bundle). 30/90 day toggle. Weight loggable in the Diet row (a measurement,
  never prefilled). /monthly review: month numbers + deltas vs the full previous
  month in code, per-system counts, goal movement, coach narration, stored in
  reviews. No new migration (reuses the reviews table).
- M5 Coach upgrade: DONE. Code detects every daily miss with context facts
  (lib/review/misses.ts: wake drift with bed-time context, morning light,
  session-behind-pace, protein/calories under, explicit skips); the coach must
  give a why + concrete reversal (exact action/time) per miss. 14-day energy
  correlations in the daily DATA (shared computeEnergyCorrelations). Goal
  staleness from review snapshots (lib/review/stale.ts, >=14 days flagged) in
  daily/weekly/monthly. Vision + goals in the daily DATA, tie-ins occasional by
  rule. coach-persona.md updated. Note: dev server caches coach-knowledge files;
  restart it after editing them.
- Deferred polish: time-of-day trend charts (wake/bed) still read awkwardly;
  revisit the chart type later.
- M5 Coach upgrade (root-cause + concrete fix, vision tie-ins).
- M6 Reframe library cleanup: DONE. Each reframe is a bordered card matching the
  Diet meal-row style, a pin ICON (SVG) instead of a text button, pinned items
  move to a Pinned group at the top and no longer duplicate in their category,
  pinned cards carry a category tag. Data verified duplicate-free. Fixed a stale
  Mind link (/checkin -> /today).
- M7 Two users + sharing: DONE. Requires running
  supabase/migrations/0005_partner.sql once. /partner (in the top nav): link by
  email (add_friend RPC; accept/decline), side-by-side week cards (energy row,
  per-system status dots, streak, goal bars), per-system visibility toggles
  (coaching_prefs.sharing.hiddenSystems), unlink. Privacy: the entries friend
  RLS policy is REPLACED by the sanitizing partner_progress() function, so
  reflections/intentions/meals never leave the owner while progress is shared
  even on private days. Partner goal progress computes only what shared data
  supports (diet-linked goals show "not shared", never a made-up number).
  Per-goal visibility added: 0006 migration hardens goals_select_friend RLS to
  exclude the owner's hidden goals (coaching_prefs.sharing.hiddenGoals).
- M8 Onboarding wizard: DONE (no migration needed).
  - Today now renders the user's ACTUAL systems ordered by day flow (rich
    bodies for Big-Five domains, generic rule/floor rows for custom systems);
    zero systems -> empty-state card; brand-new accounts redirect to
    /onboarding (guarded by coaching_prefs.onboarded).
  - /onboarding: 6-step intake (basics+sex, sleep, schedule, diet, fitness,
    mind/coaching) -> /api/onboarding/propose (Gemini returns JSON text-only
    proposal: five systems' rule/floor/ceiling/anchor, 2-3 seed goals, a
    profile brief; sanitized; hard fallback so AI failure never blocks) ->
    editable review with code-computed targets -> completeOnboarding writes
    stats, constraints, configs (sleep/exercise/schedule/mind/intake), inserts
    the five systems + linked seed goals. Refuses to double-run.
  - Coach knowledge is per-user now: loadKnowledge() is the shared base;
    userProfileSection(prefs) uses coaching_prefs.profile_brief when present,
    else falls back to your-profile.md (Mark). All 5 coach routes updated.
  - computeTargets is sex-aware (coaching_prefs.intake.sex; default male).
- M9 PWA + deploy: PWA DONE, deploy is Mark's to run (see DEPLOY.md).
  - Installable PWA: app/manifest.ts (standalone, theme #0a0a0b, maskable icon),
    layout metadata (apple-web-app, apple-touch-icon), icons generated in
    /public by scripts/gen-icons.mjs (sharp), offline-tolerant service worker
    (public/sw.js: network-first navigations, cache-first hashed assets, never
    touches cross-origin Supabase/Gemini; push + notificationclick handlers as
    the M10 seam) registered in production only via ServiceWorkerRegister,
    /offline fallback page (static + public).
  - Deploy bug fixed: outputFileTracingIncludes now ships coach-knowledge with
    ALL coach routes + onboarding (was daily-only; others would 500 on Vercel).
  - Before going live: rotate the Supabase secret + Gemini keys (were shared in
    chat), set Vercel env vars, set Supabase Site/Redirect URLs. Runbook +
    girlfriend signup note in DEPLOY.md.
- M10 Reminders engine: DONE. Requires running
  supabase/migrations/0007_reminders.sql once, plus env vars TELEGRAM_BOT_TOKEN,
  CRON_SECRET, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
  (locally and on Vercel), plus a cron-job.org GET job on
  /api/cron/reminders?secret=CRON_SECRET every 5 min.
  - One engine (lib/reminders/engine.ts): automatic reminders computed from the
    user's targets (morning light wake+15, wind-down bed-60, dinner at meal3;
    skipped when already logged; per-item toggles) + custom reminders (label,
    HH:MM, daily/weekdays/once, channel, optional system/goal link, pause).
    All per-user, per-timezone (coaching_prefs.timezone, default Europe/Vienna).
  - Channels behind one interface (channels.ts + deliver.ts): Telegram primary
    (chat id captured via /start <code> + getUpdates scan, no webhook), Web
    Push VAPID bonus (SW handlers shipped in M9). "auto" = telegram else push.
  - Never double-sends: reminder_sends unique (user, key, local date) insert
    gates every send; 'once' reminders self-disable; dead push subs pruned.
  - /reminders page (top nav): channel setup, test send, auto list, full CRUD.
  - PWA safe-area fix: env(safe-area-inset-*) padding on .shell for the notch.

## Known state notes
- Goals live in the goals table; the link kind (sleep step, sessions/week, protein) is resolved in code from the linked system's domain. RLS already lets accepted friends read goals (for the M7 partner view).
- CoachBriefing component and /api/coach/briefing route are orphaned by the v2.1 top-card cut; remove or repurpose when convenient.
- Verify each milestone with: npm run typecheck && npm run build.

## How to resume
- Open Claude Code in this folder. It reads MASTER-BUILD-SPEC.md, CLAUDE.md, coach-knowledge/, system-playbooks/, Today-Design-Spec.md, and this file, then continues from the next milestone.
- Keys are in .env.local. Rotate the Supabase secret key and Gemini key before going live (they were shared in chat earlier).
- Mark runs the dev server himself: npm.cmd run dev.

## Deploy log
- 2026-07-03: redeploy trigger (repo made public so Vercel Hobby runs a build regardless of commit author). No app changes.
