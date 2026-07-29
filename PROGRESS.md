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
- Profile page: /profile (top nav) edits name, age, sex, height, weight,
  activity, timezone, coaching style; targets recompute live and on save;
  timezone feeds reminders; coaching style now honored live in the coach
  system prompt (userProfileSection). Fills the gap where stats could only be
  set at onboarding and never edited.
- 2026-07-03: cron reminder fix (middleware whitelisted /api/cron) verified
  working end to end; use a 1-minute cron interval for near-on-time delivery.

## Post-v1 roadmap (R-series)
- R1 Trust the numbers: DONE. Sleep log stores only real values (labels
  clarified, no prefill-as-data, woke/bed-on-target quick buttons); personal
  defaults de-Marked (generic warmup/prehab/meals/morning block, empty fixed
  rocks, German-day replaced by rocksForWeekday over fixedRocks); LEGACY_MEALS
  in lib/diet/legacy-meals.json keeps old entries computing; Done/Min/Skip
  labels (internal values unchanged); system editor help + domain-aware
  placeholders (lib/systems/examples.ts). Run scripts/preserve-personal-content.mjs
  once for Mark BEFORE relying on new defaults.
- R2 Sleep Campaign 2.0 next (two-way Telegram logging, escalating wind-down,
  auto-advance step, recovery protocol, campaign card). Then R3 flexible
  tracking (cadence/counters/sub-items), R4 commitments, R5 export.
- R2 Sleep Campaign 2.0: DONE. Requires supabase/migrations/0008_telegram_state.sql
  once. Cron is the single acknowledged Telegram consumer (telegram_state
  cursor): /start codes complete links, replying UP logs the actual wake at the
  message timestamp (sane-window guarded, never overwrites, drift feedback).
  Lights-off hard stop at bed time (auto:bed), bad-night recovery protocol
  (drift >60 min, auto:recovery), auto-advance when the hold is earned (config
  updated then announced, auto:advance; all reminder times shift with it).
  Campaign strip on Today (step, hold, tonight, links to Sleep playbook).
- R3 Flexible tracking: DONE. Requires supabase/migrations/0009_cadence.sql
  once. Systems gain cadence (daily/weekly), target_per_week, unit; metric_type
  number = a +1 counter on Today (module_logs.counters). Weekly-tracked systems
  are judged over a rolling 7 days everywhere: Today glance/body, daily coach
  DATA ("judge the week"), no daily skip-misses, weekly review count/target with
  autopilot labels from the weekly target, per-system trends chart weekly totals
  vs target, and goals can link to any weekly-tracked system (weekly_system).
  System editor: cadence/target/unit fields + Start-from-template (Networking,
  Reading, Language practice, Skill practice).
- R4 Commitments: DONE. Requires supabase/migrations/0010_commitments.sql
  once. Weekly contracts (max 3, Monday weeks, code-judged: passed the moment
  the target is met, failed at week end), Telegram verdicts, opt-in partner
  exposure on failure (coaching_prefs.commitments.exposePartner; partner reads
  via sanitized partner_commitments RPC, debriefs never leave the owner),
  forced debrief gates the weekly review (min 20 chars, quoted back by the
  coach later), Cookie Jar records (lib/records) in daily+weekly DATA with a
  one-record rule, commitments in daily DATA with AT RISK detection, Today
  shows a commitments card + 4-week momentum rings per system row, /weekly
  hosts the manager (create/remove/history/exposure toggle).
- Weekly-page fixes: single commitment picker (all systems + wake hold in one
  dropdown, target label adapts, tolerance only for wake), exposure toggle is
  optimistic (instant flip, revert on error).
- R5 Monthly export: DONE. /api/export?month=YYYY-MM&format=json|md (auth
  required, own data only): raw JSON (entries, systems, goals, commitments,
  reviews, month stats, records) or an LLM-ready markdown brief. Download
  buttons on /monthly. No AI runs to produce exports.
- Fixes: commitment target input types freely (string state, clamp on
  submit), weekly target can no longer save as null (weekly defaults to 3;
  display no longer masks null), days-left chip says "ends Sun", form-row grid
  children clamped so time inputs stay inside cards on mobile.
- R6 Accountability scoring: DONE. Requires running
  supabase/migrations/0011_scoring.sql once (ledger table + partner_ledger RPC).
  Built with the orchestrator split (foundation/cron/coach by the orchestrator,
  the three UI packages by parallel Opus workers). Confirmed with Mark, changing
  his v2.0 doc: (1) a system's Min counts as a full point (Done-or-Min = 1,
  Skip/no-log = 0); (2) running STAYS a punishment (per his doc), with a declared
  bad-body day waiving that day's run only (the fine still applies); (3) the
  Gear/Trip Fund is a renamable goal with an optional target and a progress bar.
  Also live: personal cutoff (default 03:00, not midnight); fines and runs are
  ledger obligations he marks paid/done (the app cannot move money or block
  apps); the entertainment lock is a declared state the app reports.
  - Engine (lib/score/score.ts, pure): dayScore (Sleep via bed<=target AND
    duration>=hours with tolerance; others Done-or-Min, or counter>=1), dayGrade
    (proportional bands, exact doc at max 4), weekScore + weekGrade (integer
    thresholds scaled from the 28-point doc, plus critical-day demotion),
    consequencesForDay/Week (fine/run/lock/reward, runs kept), escalateFine/Run
    (3 identical in a row steps up; an A/S week resets), computeLock (live from
    ledger + green days; green3 for an F week), fund balance/contributed/pct.
  - Config in coaching_prefs.scoring (lib/score/config.ts): enabled, startDate,
    systemIds, cutoffHour, sleepToleranceMin, dailyFine, weeklyFines,
    runsEnabled, runsWaiverAllowed, dailyRunKm, weeklyRunKm, escalation,
    notifyPartner, fund{name,targetEur}, rewardCatalog, exceptions[{date,reason,
    kind:excused|bad_body}].
  - Ledger (migration 0011): fine/run/lock/reward/payout rows, status
    pending|done|waived, RLS own-all, sanitized partner_ledger(friend) RPC.
    Grades are computed, never stored; reminder_sends keys 'score:day:<date>' /
    'score:week:<monday>' (sent_on = the judged date) make judgment exactly-once.
  - Cron (app/api/cron/reminders): per user past cutoff, judge yesterday and the
    last complete week, insert ledger rows, release locks on green days, Telegram
    the owner and (when notifyPartner) the partner verifier. Reply PAID settles
    all pending fines. Weekly lock rows are dated at the week end so they clear
    only on a green day in the following week.
  - UI: Today shows a day-score chip (links to /weekly) + a red LOCKED banner;
    /weekly hosts the Score card (day-grade strip, week points + projection, fund
    progress bar with rename/target/log-payout, pending fines/runs with
    Paid/Waive, declare-exception, full settings, enable/disable); /partner shows
    both people's ledger summary (fund, pending, lock) via the RPC. Coach
    daily+weekly DATA carries grade/lock/fund/pending; the coach states
    consequences as already decided, never negotiates or invents amounts.
  - Mark's setup: run 0011 once in the Supabase SQL editor. On /weekly open the
    Score card, tick the scored systems (Sleep, Exercise, German, Reading),
    Enable. Set the fund name + target. To score Sleep you must log BOTH bed and
    wake (the doc's rule; wake logs via Telegram UP). Cron already runs; verdicts
    land after your 03:00 cutoff. Test: log a day, pass the cutoff (or hit the
    cron URL), confirm the ledger row on /weekly and the Telegram verdict.
  - Deferred: Sleep has no "Min" floor yet (needs both bed+wake); weekend-lock
    escalation for repeated failed weeks is not special-cased (fine/run
    escalation covers the spirit). Revisit if Mark wants them.
- R6.1 refinements (no migration): DONE.
  - Accountability now splits scored systems: DAILY systems drive the daily
    grade + daily fines; WEEKLY-target systems (cadence weekly or counters) are
    judged ONCE at week end (short of target = one fine, size dailyFine),
    never daily-fined (lib/score/score.ts isWeeklyScored + weeklySystemResults;
    cron weekly block). dayGrade/weekGrade return best grade when max is 0 (no
    daily systems = vacuously clean, no phantom fines).
  - Exceptions are date RANGES now ({from,to,reason,kind}; old {date} rows
    migrate in readScoreConfig). Actions: declareException(from,to,...),
    removeException(from,to), liftLock(today), resetAccountability(today)
    (waives all pending fine+run and lifts the lock; fund untouched),
    addManualLedger (manual fine/run). Cron auto-logs fines at cutoff already.
  - Momentum ring fixed: daily systems score over days elapsed since created_at
    (unlogged = miss), not just logged days; weekly use count vs target*weeks.
  - Commitments kept but reframed as uncapped "weekly sprints" (cap 3 -> 12
    backstop), clearly separate from the standing accountability system.
  - Score card settings rewritten into labeled sections (Scored systems /
    Timing / Money / Runs / Escalation / Partner / Rewards / Danger), no bare
    B/C/D/F, grouped toggles; weekly-habits progress section; lift-lock, reset,
    manual add, range-exception UI with collapsed history.
  - Partner page shows both people's fund progress bar + pending + lock.
- NEXT SESSION: R6 + refinements shipped. Next is whatever Mark raises.
