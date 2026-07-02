# Master Build Spec: Scott Adams Life OS (for Mark)

This is the single source of truth for finishing this app. It defines the whole product, the design rules, the data model, and the build approach. Build to this. Do not improvise structure that contradicts it. When something here points to another file (the playbooks, the coach knowledge, the Today spec), read that file too.

---

## 0. How to use this spec (Claude Code)

Follow Anthropic's loop: Explore, Plan, Implement, Commit.

1. **Explore:** read this spec end to end, then read `CLAUDE.md`, everything in `coach-knowledge/`, everything in `system-playbooks/`, `Today-Design-Spec.md`, and `PROGRESS.md`. Skim the existing code so you know current state.
2. **Plan:** produce a milestone plan (use the milestones in section 14 as the baseline) and show it before writing code. Flag anything ambiguous.
3. **Implement:** build one milestone at a time. After each, verify (type-check and build pass, plus the manual test steps for that milestone) and tell Mark exactly how to test it.
4. **Commit:** commit after every milestone that passes. Never leave the app broken between milestones.

Hard rule throughout: do not regress working features. The app already works; you are extending it.

The dev server is run by Mark in his own terminal (`npm.cmd run dev`). Do not fight background dev-server processes; just make changes and let his server hot-reload.

---

## 1. What this is, and the principles that never bend

A personal life operating system built on Scott Adams' philosophy, tailored to Mark. It is a directive AI coach plus an editable systems engine. It is not a habit tracker.

Principles (these govern every decision):

- **Systems over goals.** The daily engine is systems (the Big Five). Goals are direction, and their progress is mostly pulled from the systems. The user never "works on a goal" daily; he runs systems and goals move.
- **Energy is the master metric.** Everything rolls up to one daily energy number. Every feature should help raise it.
- **Simplify, do not optimize.** Progressive disclosure everywhere. Show little, hide the rest behind a tap. If a screen feels busy, it is wrong. This was the single biggest source of rework, so respect it.
- **Reduce decisions to routine.** Defaults, prefilled values, short menus. Never make the user start from zero.
- **Floor and ceiling.** Every physical habit has a bad-day floor that still counts.
- **The reliability rule:** code does everything exact (all numbers, dates, streaks, totals, progress, the sleep-shift step, correlations). The AI only coaches: the briefing, the reviews, the reframes, answers to questions. The AI reads numbers from code and never computes or invents them. This is non-negotiable; it is what keeps the app from making the mistakes Mark hates.

Voice and doctrine live in `coach-knowledge/`. The coach is Adams (spine) plus Hormozi (standards), the Stoics (reframing), and Huberman (sleep science). Hardcore, directive, tight, no filler, no emojis, no em dashes.

---

## 2. Stack and current state

Stack: Next.js (App Router, TypeScript) + Tailwind, Supabase (Postgres, auth, row-level security), Google Gemini (`gemini-2.5-flash`) called from a server route with the key server-side, deploy target Vercel, installable PWA. Keys are in `.env.local`.

Already built and working (do not rebuild, extend):
- Auth (email/password), the four tables (`users`, `systems`, `entries` with a `module_logs` jsonb column, `friendships`), RLS.
- The Today page in its calm v2/v2.1 form: single column, energy headline, collapsed system rows, day navigation, inline logging, the dynamic daily briefing, the evening review modal, ask-the-coach.
- The five system playbooks: Sleep, Morning & schedule, Mind, Diet, Exercise (each seeded for Mark from `coach-knowledge/your-profile.md`).
- The daily coach review (verdict, read, one move, tomorrow), grounded in the knowledge files, reading code-computed numbers.
- History of past days.

If anything in the current Today page still contradicts `Today-Design-Spec.md` (v2 and the v2.1 refinements), fix it as part of milestone 1.

---

## 3. Definition of done for v1 launch

The app is done for launch when all of these are true:
- Today is calm and complete per `Today-Design-Spec.md`, including the diet quick-entry and the Mind journal (intention + reflection).
- Goals exist as a year-and-quarters roadmap, on the Today page and in a full view, with progress.
- Daily, weekly, and monthly reviews all work.
- A trends view with charts exists, and the coach surfaces patterns from it.
- The coach does root-cause-plus-concrete-fix when the user misses a plan (see section 7).
- The reframe library is clean (no duplicates, pin icon, grouped).
- Two users work: Mark and his girlfriend each have accounts, see each other's progress, with private notes hidden.
- A new user can run the onboarding wizard and get a personalized Life OS.
- The app is an installable PWA and is deployed live at a URL both can reach.

Phone push notifications are a fast-follow right after launch, not a launch blocker. In-app reminders ship in v1.

---

## 4. The Today page (final shape)

Authoritative detail is in `Today-Design-Spec.md` (v2 plus the v2.1 refinements). Summary of what must be true:

- One calm centered column. No multi-column cockpit.
- Header: date with day navigation (prev / next / Today), the energy headline (master metric), today's one-line focus.
- Top card: the daily gem, and at most one short dynamic focus line. No static target recitation, no "show today's plan" dump.
- The five systems as collapsed rows, in this order: Sleep, Morning & schedule, Training, Diet, Mind. Each row shows name, at-a-glance status, and one glance value where useful. Tap to expand and log. A system can be marked done with one tap without expanding.
- Diet: the primary input is calories and protein with plus/minus steppers, prefilled from yesterday (or a baseline) so it never starts at zero. The meal menu is optional and collapsed. Water and snacks stay.
- Mind: the daily journal. Morning intention (one line) and an evening reflection with one or two light prompts ("What happened today?", "What did I do about it?"), the Private toggle, and a link to the Mind playbook.
- A compact Goals card (see section 5) below the rows.
- Review my day and Ask the coach as buttons. The review opens in a panel/modal showing only the coach output. Save and Private sit together with the reflection.

---

## 5. Goals and Projects (designed; build this)

Drop the Eisenhower quadrants for goals entirely (Q4 means "delete," so it does not belong in a goals view). Use a year roadmap split into quarters. This is the synthesis of the roadmap and dashboard patterns: a timeline for direction, progress for tracking, tied to the vision.

Structure:
- **Vision as the north star.** Pull the pinned vision from the Mind system and show it at the top of the Goals view, so projects ladder up to it.
- **Year roadmap, four quarters.** The current year laid out as Q1 to Q4 (columns or a horizontal timeline), current quarter highlighted.
- **Projects/goals as cards** placed in their target quarter. Each project has: title, a one-line why (tie to the vision), target quarter, a progress bar, notes, optional milestones, and an optional link to a system for automatic progress.
- **Progress in code.** If a project links to a system, derive progress from it (for example a wake-time project reads the sleep-shift step, a strength project reads sessions-per-week and weight, a diet project reads adherence). If not linked, progress comes from manual milestones or a manual percent. The AI never computes progress.
- **On Today:** a compact card showing the current quarter's projects with progress bars, and a small four-quarter strip. Tap to open the full year view. Keep it compact; it must not dominate Today.
- **Interactions:** add a project, set its quarter, move it between quarters, update progress and notes, mark milestones. All inline, no separate heavy page required (a full-screen view is fine, but reachable in one tap and visually consistent).

Keep the chain visible: Vision leads to Projects (direction and progress) leads to the daily systems (execution). Tasks/triage stay in the Morning & schedule playbook's Eisenhower matrix, which is separate and unchanged.

---

## 6. Reviews: daily, weekly, monthly

All three read code-computed numbers and trends. The AI narrates. All in the coach voice and the clean format.

- **Daily (built):** verdict, the read across all systems, the one move, tomorrow's plan, reading the day's logs and the reflection.
- **Weekly:** on a day the user picks (default Sunday). Reads the last 7 days. Reports: which systems ran on autopilot vs needed willpower, the energy-to-habit correlations (computed in code), one system to shrink or move or cut, movement on goals this week, and the next step in the active sleep-shift campaign. Entry point: a card on Today and a clear surface, highlighted on the chosen day.
- **Monthly:** a zoom-out the user can run near month end. Reads the month. Reports: the month's trends (energy, sleep consistency, adherence, weight, protein), progress on each project/goal, what changed versus last month, and the single biggest lever for next month. Produces a clean, keepable monthly summary (viewable in-app; printable/shareable is a plus).

---

## 7. Coach behaviors (the heart of it)

The coach must do all of the following. These are what make it a system, not a tracker.

1. **Root-cause plus concrete reversal (top priority, Mark's explicit ask).** When the user misses something he planned (skipped the session, slept late, came in under protein, missed morning light), the coach must (a) name the likely why using the day's data and context (for example: late session skipped after a 2:40 bed and an energy of 4, or protein low on a day with no logged dinner), and (b) give a specific, concrete fix for tomorrow, never vague. Concrete means an exact action, time, and adjustment. Not "try to sleep earlier" but "lights off and book in hand at 1:30, phone on the charger across the room, wake stays 10:15 even if you're tired." Every miss gets a why and a precise reversal.
2. **Find patterns.** Surface correlations from the code-computed stats (for example, energy is highest on training days, or dips the day after a sub-6-hour night). Use these in the weekly and monthly reviews and when relevant in the daily.
3. **Reframe.** When the user's words show negative self-talk, offer a reframe from `coach-knowledge/reframes-library.md` (old frame, new frame, the cue).
4. **Tie to vision and goals occasionally.** Not every day. Connect today's effort to a project or the vision, and flag a project that has not moved in a while.
5. **Hold the campaign.** Keep the user on the active sleep-shift step; advance it only when the hold criteria are met (code decides eligibility).

The coach never invents numbers. It reads them. If a number is missing it says so.

---

## 8. Trends and usable data

- A **trends view** with readable charts over time: energy, sleep consistency (wake-time adherence), system adherence, weight, protein. Use a charting approach that stays clean (small multiples or a few clear line charts, not a busy dashboard).
- The coach's **pattern-finding** (section 7.2) reads these code-computed series.
- The **monthly summary** (section 6) packages the month's trends and goal progress.
- CSV export is not required for v1 (the user did not prioritize it). Leave a clean seam to add it later.

---

## 9. Two users and sharing

- Mark and his girlfriend each have their own account, their own systems, entries, and goals.
- Linked users (a `friendships` link) see each other's progress: energy, streaks, system adherence, and goal progress. Journal entries, reflections, and any entry marked private stay hidden. Enforce with row-level security.
- A simple partner view: see your friend's progress side by side with yours. Keep it supportive, not a noisy feed. A light shared accountability signal (for example, a nudge when one of you breaks a streak) is welcome but optional for v1.

---

## 10. Onboarding wizard (for new users / the girlfriend)

- A new user signs up and runs an intake: energy baseline, schedule, vision, sleep pattern, diet preferences and constraints, fitness level and goals, coaching preferences, and main failure modes.
- From the answers, the AI proposes a starting set of Big Five systems, a draft daily shape, and a few seed goals. The user edits before saving.
- Result: a personalized Life OS, not a copy of Mark's. The same engine serves everyone; the content is per-user.

---

## 11. Reframe library cleanup

In the Mind playbook, redesign the reframe library: each reframe is one clean card (old to new line, a small category tag, a pin icon on the row). Pinning sorts it to a Pinned group at the top without duplicating the item. Group by category with clear headers. Match the Diet card style.

---

## 12. Reminders, PWA, deploy

- **In-app reminders (v1):** time-aware nudges based on the clock and the user's targets (morning-light window, wind-down soon, pull dinner earlier). Shown in-app.
- **PWA (v1):** installable on phone and desktop, same synced data, offline-tolerant shell.
- **Deploy (v1):** deploy to Vercel, wire Supabase and the Gemini key as environment variables, confirm both users can reach it. Provide a short note for the girlfriend on how to sign up.
- **Phone push notifications:** a fast-follow right after launch (web push needs the installed PWA and a small scheduler). Leave a clean seam for it.

---

## 13. Visual and UX standards

- Calm and progressive: show little, reveal on tap. This is the highest design law here.
- Single comfortable column for the daily surface. Cards for grouped content, consistent padding, labels always separated from values.
- Keep the current dark theme with the amber accent, refined. No theme overhaul unless asked.
- No walls of text. Break content into short blocks and cards.
- Everything must read well on a phone (PWA) and on the laptop.
- Match the Diet card styling, which is the reference for "clean" in this app.

---

## 14. Data model (final)

Existing: `users`, `systems`, `entries` (with `module_logs` jsonb), `friendships`.

Add for goals:
- `goals` (or `projects`): id, user_id, title, why, target_year, target_quarter, progress_type (auto or manual), linked_system_id (nullable), manual_progress (nullable), milestones (jsonb), notes, status, created/updated.

Reviews can be computed on demand from `entries` and stored only if caching is needed (a `reviews` table is optional). Trends are computed from `entries`. Keep all derived numbers in code.

Row-level security: a user sees only their own rows, except linked friends may read each other's non-private progress fields.

---

## 15. Build milestones (baseline plan)

Build in this order, verify and commit each. Each milestone must leave the app fully working.

- **M1: Today cleanup to spec.** Make the Today page fully match `Today-Design-Spec.md` v2.1 (diet quick-entry, Mind journal with reflection, top-card trimmed, order, button tidy). Verify against the v2.1 checklist.
- **M2: Goals/Projects** (section 5): the `goals` table, the year-quarter roadmap view, the compact Today card, progress from linked systems and manual milestones.
- **M3: Weekly review** (section 6).
- **M4: Trends view + monthly review + pattern-finding** (sections 6, 8).
- **M5: Coach upgrade** (section 7): root-cause-plus-concrete-fix across daily, weekly, monthly; vision/goal tie-ins; pattern use. Update `coach-knowledge/coach-persona.md` output rules if needed.
- **M6: Reframe library cleanup** (section 11).
- **M7: Two users and sharing** (section 9): partner view, RLS for shared progress.
- **M8: Onboarding wizard** (section 10).
- **M9: PWA polish and deploy** (section 12). Push notifications as a documented fast-follow.

After each milestone, give Mark a short, plain-English test (a few steps), and wait for his confirmation if the change is user-facing and significant. Small internal steps inside a milestone do not each need a check-in; the milestone boundary does.

---

## 16. Acceptance criteria (spot checks)

- The daily screen, on first open, shows energy, a gem, five collapsed rows, a compact goals card, and two buttons. Nothing else. If it looks busy, it fails.
- Logging a full day takes well under five minutes and never starts a field at zero where a sensible default exists.
- Every coach output (briefing, daily, weekly, monthly) references the user's real numbers and, on any miss, gives a why and a concrete fix. No vague advice.
- No coach output ever contains a number the code did not provide.
- A second user can sign up, onboard, and see Mark's shared progress without seeing his private notes.
- The app installs as a PWA and runs deployed at a URL.

---

## 17. Final locked decisions (these refine sections 9, 10, 12)

### Onboarding: how each user gets their own systems (refines section 10)
Decision: the onboarding wizard with AI-generated, editable per-user content. Not a separate Claude Code per person, not manual-from-scratch, not file-sharing.
- The five systems (Sleep, Morning & schedule, Mind, Diet, Exercise) are the shared skeleton for everyone.
- The content inside each is per-user. On signup the new user answers an in-depth intake (same domains as Mark's profile: stats, schedule, vision, sleep pattern, diet preferences and constraints, fitness level and goals, coaching prefs, failure modes).
- The AI turns those answers into that user's personalized playbooks: their meals (from their groceries and preferences), their exercises (their level and equipment), their sleep targets and shift, their vision and goals. Code computes their calorie and macro targets from their stats. They review and edit before saving.
- Reuse the same profile-to-systems seeding path already built for Mark, driven by the new user's answers instead of his. Same engine, different content.

### Sharing and accountability (refines section 9)
Decision: a partner progress window for mutual accountability. No in-app messaging (they text each other outside the app).
- Linked users see each other's daily and weekly progress: which systems were done, floored, skipped, or missed; energy; streaks; goal progress.
- Seeing a miss is the point, so they can push each other externally ("you didn't do X today, why?").
- Privacy: journal and reflection and any item marked private stay hidden. A per-system visibility toggle lets each person hide specific things and show the rest.
- Provide a weekly shared view (both people's week at a glance) plus the daily detail. No in-app chat; this is a progress window only.

### Reminders: real iPhone notifications, free (refines section 12)
Goal: reminders for all systems and scheduled things (morning light, wind-down, dinner, training, and any timed item), delivered to the iPhone, free. Reminders are per-user and respect each user's own times.

Build one reminder engine with two delivery channels, so at least one always works:

1. **Free external scheduler.** Use cron-job.org (free, unlimited jobs, one-minute granularity) to ping a serverless API route every few minutes. Do NOT rely on Vercel's built-in cron, which on the free tier only runs once per day. The route checks each user's target times and due nudges and sends whatever is due.
2. **Channel A, Web Push (PWA).** For users who installed the app to the home screen and granted permission. iOS supports Web Push for home-screen web apps on iOS 16.4+ using VAPID (no Apple certificates), requires manifest.json and a permission prompt fired on a tap. Honest caveat: EU regulatory back-and-forth affected home-screen web apps; Apple reversed the removal, so it should work in Austria, but verify on Mark's actual iPhone at deploy before relying on it.
3. **Channel B, Telegram bot (the guaranteed fallback, works everywhere).** A simple Telegram bot sends reminder messages that land as normal phone notifications. Free, reliable, no App Store, no EU caveat. The user links Telegram once by tapping a bot link. Treat this as the primary reliable channel; web push is the nicer bonus where it works.

Reminder timing and what is due are decided in code from each user's schedule and targets. The message wording can be in the coach voice. Build the engine once with a clean channel interface so a channel can be added or swapped later.
