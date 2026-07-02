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
- M4 Trends + monthly review + pattern-finding: next. The reviews table + the
  weekly stats/correlations code are reusable for monthly.
- M5 Coach upgrade (root-cause + concrete fix, vision tie-ins).
- M6 Reframe library verification pass (mostly built already).
- M7 Two users + sharing (partner view, visibility toggles, RLS).
- M8 Onboarding wizard.
- M9 PWA + deploy to Vercel.
- M10 Reminders engine (cron-job.org + Telegram + web push), fast-follow.

## Known state notes
- Goals live in the goals table; the link kind (sleep step, sessions/week, protein) is resolved in code from the linked system's domain. RLS already lets accepted friends read goals (for the M7 partner view).
- CoachBriefing component and /api/coach/briefing route are orphaned by the v2.1 top-card cut; remove or repurpose when convenient.
- Verify each milestone with: npm run typecheck && npm run build.

## How to resume
- Open Claude Code in this folder. It reads MASTER-BUILD-SPEC.md, CLAUDE.md, coach-knowledge/, system-playbooks/, Today-Design-Spec.md, and this file, then continues from the next milestone.
- Keys are in .env.local. Rotate the Supabase secret key and Gemini key before going live (they were shared in chat earlier).
- Mark runs the dev server himself: npm.cmd run dev.
