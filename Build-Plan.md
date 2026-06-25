# Life OS, Build Plan v2

This is the real plan, built from your answers. It replaces v1. It covers the architecture, the editable systems engine, your personalized defaults, the coach and its grounding, the two-user setup, the modules (calorie math, fitness programming, diet, Eisenhower, reframes, daily gems), the first campaign, and a Claude Code brief at the end you can paste to start the build.

Companion files live in `coach-knowledge/`: the persona, the Adams doctrine, the reframes library, the daily wisdom pool, and your profile. Those are the AI's brain.

---

## 1. What changed from v1

- The system is now Adams' real Big Five (flexible schedule, imagination, sleep, diet, exercise), not my invented buckets.
- The coach is grounded in a knowledge base and a hard persona, so it talks like a real coach, not a generic chatbot.
- It teaches, plans, and schedules. It is not a tracker.
- Every system is editable from inside the app. Nothing is hard-coded.
- Two users with shared progress and private notes, hosted, on phone and laptop.
- The AI is Gemini free tier. Anything that must be exact is done in code, not by the AI.

---

## 2. Architecture

**Stack.** Next.js app deployed on Vercel. Supabase for the database, accounts, and security. Google Gemini (free Flash) for the coach, called through a Vercel server function so the key stays hidden. Responsive layout plus PWA, so it installs on your phone home screen and runs on your laptop with the same synced data.

**The reliability rule (this is the one that matters to you).** The app splits work in two:

- **Code does anything exact.** Calorie and macro math, the sleep-shift schedule, streaks, dates, time blocks, trend charts, the Eisenhower sort. Deterministic. It cannot get these wrong.
- **The AI does judgment.** Coaching, the daily and weekly review, reframes, encouragement, picking the next action. It reads the exact numbers from the app, it never computes them.

That separation is why this won't do the thing you hate. The model is never in a position to fumble a number or a date.

**Why this stack.** It's the boring, proven combination for a small hosted app. Both free tiers cover two users with huge headroom (Supabase free allows 50,000 monthly users, Gemini free allows about 1,500 requests a day). Nothing here costs money at your scale.

---

## 3. The editable systems engine

A "system" is data, not code. Each one is a record you can create, edit, archive, or rewrite from the app. No rebuild, ever.

A system has:
- name and domain (one of the Big Five, or custom)
- the rule (the behavior you repeat)
- the floor (the bad-day version that still counts)
- the ceiling (the full version when energy is high)
- the metric (what you log: done/skipped, a number, a 1 to 10)
- the anchor (the existing habit or time it attaches to)
- the schedule block (when it lands in your day)
- active or archived

The Big Five ship pre-filled for you (section 5). You can change any field, add a sixth system, or retire one that isn't working. Your friend gets the same control over their own.

---

## 4. The coach and how it's grounded

**Grounding, not fine-tuning.** We don't retrain Gemini. Before the coach speaks, it loads the knowledge base: the persona, the Adams doctrine, the reframes, the wisdom pool, and your profile. Gemini's large context window means we load real doctrine, not a thin summary. Result: it reasons and talks like Adams crossed with Hormozi, the Stoics, and Huberman, tuned to you.

**The four jobs the coach does (this is what makes it a system, not a tracker):**

1. **Teaches.** Short, just-in-time explanations of why a system works, in the doctrine's logic. The reasoning up front when a topic is new, then it stops repeating itself. Matches how you said you learn.
2. **Plans.** Turns your config and your campaign into a recommended daily and weekly structure.
3. **Schedules.** Hands you calendar-ready blocks with a one-line reason each. You paste them into your calendar (no calendar integration, per your call, since your work calendar shifts and you don't want it breaking).
4. **Coaches.** Reads your data daily and weekly, gives one next action, catches drift, reframes negative self-talk, and proposes changes when a system keeps failing.

**Directiveness.** Set to hardcore, as you asked. It gives orders, not gentle nudges. It explains once, then runs the system.

**Guardrails** are in `coach-persona.md`: never invent numbers, never make big life decisions, stay inside the knowledge base, respect your constraints (lactose-free, low sugar, ankle, no work tasks), and ask one sharp question when unsure instead of hedging.

---

## 5. Your personalized Big Five (what ships configured for you)

These are your starting systems. All editable.

**Flexible schedule.** Mornings before 3pm are your battlefield, since work owns 3pm to 10pm and shifts week to week. The app builds your morning, leaves the work window loose, and gives you a personal Eisenhower matrix for life and new-venture ideas (work and ClickUp stay out). During the unpredictable work block, it offers a short "slot when free" task list instead of rigid timed blocks.

**Imagination.** A light morning intention (optional, one line) and a real evening reflection. A daily philosopher gem from the wisdom pool, Stoic-leaning. A reframe surfaces whenever your check-in shows negative self-talk. Your vision (leader, own team, multi-entrepreneur, athletic, free) is stored and the coach points the systems at it.

**Sleep.** The keystone, and the first campaign (section 7). Two metrics only at first: wake-time consistency and bedtime. Wind-down anchored to reading, not teeth, since you said teeth does nothing.

**Diet.** A short menu of energizing defaults built from Vienna groceries (Hofer, Billa, Spar) and air-fryer-fast prep. Simple-carb cut to kill the sluggish feeling. Protein-first. Low added sugar for the diabetes risk. A calorie and macro calculator (section 6) so you hold 88 kg and gain muscle. No fasting. Meals pulled into a tighter window so you're not eating all day, while still hitting calories (see profile).

**Exercise.** Adam Ondra warm-up every morning. A real strength-endurance program for home and outdoors, scaled for an ex-powerlifter, not beginner fluff. Ankle prehab built in. Floor-and-ceiling so a bad day still counts.

---

## 6. Modules

**Calorie and macro calculator.** Code-based. From your stats and activity it computes maintenance, a lean-gain target, and a protein goal, then checks your logged eating against it. At age 22, 188 cm, 88 kg, that's about 3,100 kcal maintenance, about 3,350 for lean gain, and around 170 g protein. The coach reads these, never guesses them.

**Fitness programming.** A rotating menu of strength-endurance and power sessions for home and outdoors, plus the daily Ondra warm-up and an ankle prehab block. Progressive, scaled to your level. You pick from the menu so there's no daily decision.

**Diet defaults.** 5 to 10 meals you'll actually rotate, mapped to Hofer and Billa items and air-fryer prep, protein-first, low sugar, lactose-free. A weekly shopping list generated from the menu.

**Personal Eisenhower matrix.** For life and new revenue ideas. Sorts Q1 to Q4 in code, protects Q2. Separate from work.

**Reframe engine and daily gem.** Pulls from `reframes-library.md` and `daily-wisdom.md`. One gem a day, attribution shown honestly. Reframes triggered by your own words in the check-in.

---

## 7. Campaign 1: sleep-shift plus morning routine

You chose to run these together. Here's how the coach drives it.

**The shift.** You won't jump from 2 to 3am to 8am. The coach moves your wake and bed times earlier in 15 to 30 minute steps, holding each step until it sticks before the next. Wake-time consistency leads, since a steady wake time pulls bedtime along behind it (Huberman: consistent wake time matters more than bedtime, stay within about an hour every day, weekends included).

**The morning routine that anchors it.** As the wake time moves earlier, the app installs the morning sequence:
- Morning sunlight within 30 minutes of waking, 5 to 10 minutes on a clear day, 15 to 20 if overcast. Huberman calls this the single strongest lever for sleep. It also matches what lifts you (nature, being outside).
- Adam Ondra warm-up to wake the body.
- A 90-minute deep-work or personal block, then a training session, since that's your natural rhythm.
- Optional park or reading time, which doubles as light exposure and the thing that recharges you.

**The dinner lever.** Eating after 10pm feeds the late cycle. The coach works your dinner earlier in steps, the same way as the wake time. This is the single biggest diet lever for your sleep, so it runs inside this campaign, not separately.

**No caffeine to manage,** so that lever is off the table for you, which actually simplifies the shift.

Everything else (full diet menu, the Eisenhower matrix, the fitness progression) stays in maintenance mode until the sleep cycle holds, so you're not fighting five fronts at once. That's the simplify rule protecting you from your own "too many tools" failure mode.

---

## 8. Daily loop and weekly review

**Daily check-in, up to 5 minutes.** Energy slider (1 to 10, the headline). Tap your systems done or floored or skipped. Log eating against the menu. One line on the day. Negative self-talk gets a reframe. The coach returns a 30-second read plus one correction for tomorrow, and the next morning's plan.

**Weekly review session.** The coach walks you through it: which systems run on autopilot, which still need willpower, one to shrink or move or cut, whether energy tracks any specific habit, and the next step in the sleep campaign. Pick the day.

---

## 9. Two users, shared progress, private notes

- You and your friend each have an account.
- Each builds and edits your own systems and tasks. Your friend is not stuck with your setup.
- You can see each other's progress: energy trend, streaks, adherence. A light accountability view, not a feed.
- Journal entries and personal notes are private by default, with a per-entry share toggle.
- Supabase row-level security enforces "we two can see each other, nobody else can."

**Friend onboarding.** A new user signs up and runs the same intake wizard you answered. The AI generates their starting Big Five and a draft schedule from their answers, which they then edit. Same build serves both of you. You can add your friend now or later with no rework.

---

## 10. Cross-device

The web app is responsive and installable as a PWA, so it sits on your phone home screen like a native app and opens the same on your laptop, data synced through Supabase. You're at your computer daily, so the laptop is primary, but the phone works for the morning check-in away from the desk.

---

## 11. Data model (for the build)

Four core tables in Supabase.

- `users`: id, name, email, age, height, weight, activity level, constraints (lactose-free, low sugar, ankle), coaching prefs.
- `systems`: id, user_id, name, domain, rule, floor, ceiling, metric_type, anchor, schedule_block, active.
- `entries`: id, user_id, date, energy (1-10), per-system status, meals logged, one_line, reflection, tomorrow_next_action, private flag.
- `friendships`: the link that lets two users see each other's progress, governed by row-level security.

Config that's exact (calorie targets, the sleep-shift schedule, streaks) is computed in code from these tables, not stored as the AI's opinion.

---

## 12. Build sequence

1. Scaffold the Next.js app, Supabase project, and auth. One account working end to end.
2. Build the editable systems engine and the daily check-in, saving to Supabase.
3. Seed your personalized Big Five defaults.
4. Add the Gemini server function and load the knowledge base. Daily review working.
5. Build Campaign 1 logic: the sleep-shift stepper, the morning routine, the dinner stepper.
6. Add the calorie calculator and the fitness and diet menus.
7. Add the weekly review, the reframe engine, the daily gem, and the personal Eisenhower matrix.
8. Add the second user, shared progress, and the friend onboarding wizard.
9. PWA polish for phone install.

Ship after step 5. That's the keystone working. The rest are fast follows.

---

## 13. Claude Code build brief

Paste this into Claude Code to start. Keep the `coach-knowledge/` files in the repo so the app can load them.

```
Build a personal "Life OS" web app for two users. It is a directive AI coach plus an editable systems engine, grounded in Scott Adams' philosophy. Not a habit tracker.

STACK:
- Next.js (App Router) deployed to Vercel. Responsive + PWA (installable on phone, same synced data on laptop).
- Supabase for Postgres, auth, and row-level security.
- Google Gemini free tier (Flash) for the coach, called via a Vercel server function so the API key stays server-side. Isolate the AI call behind one module so the provider can be swapped later.

NON-NEGOTIABLE RELIABILITY RULE:
- Code does everything exact: calorie/macro math, the sleep-shift schedule, streaks, dates, time blocks, trend charts, Eisenhower sorting. Deterministic, tested.
- The AI only does judgment: coaching, daily/weekly review, reframes, next action. It READS exact numbers from the app and never computes them. If a number isn't provided, it says so.

EDITABLE SYSTEMS ENGINE:
- A "system" is a database record: name, domain (one of Adams' Big Five or custom), rule, floor, ceiling, metric_type, anchor, schedule_block, active. Full CRUD from the UI. Nothing hard-coded.

THE COACH:
- Before each call, load the knowledge base from /coach-knowledge: coach-persona.md, adams-doctrine.md, reframes-library.md, daily-wisdom.md, and the user's profile. Use them as system context.
- Persona: hardcore, directive, strategic, tight. Explains the why once, then gives orders. No filler, no emojis, no em dashes.
- Outputs are structured and short. Daily review: a 30-second read + one correction for tomorrow + the next morning's plan. Weekly review: which systems are automatic vs willpower, one to shrink/move/cut, energy-habit correlation.
- It teaches, plans, and schedules (hands the user calendar-ready blocks to paste manually; no calendar integration).

DATA MODEL (Supabase):
- users (id, name, email, age, height_cm, weight_kg, activity_level, constraints, coaching_prefs)
- systems (id, user_id, name, domain, rule, floor, ceiling, metric_type, anchor, schedule_block, active)
- entries (id, user_id, date, energy_1_10, system_statuses jsonb, meals jsonb, one_line, reflection, tomorrow_next_action, is_private)
- friendships (user_id, friend_id, status) with RLS so two linked users see each other's non-private progress only.

ONBOARDING WIZARD:
- New users answer the intake (energy baseline, schedule, vision, sleep, diet, fitness, constraints, coaching prefs, failure modes).
- From the answers, the AI proposes a starting set of Big Five systems and a draft schedule. The user edits before saving.

MODULES:
- Calorie/macro calculator (code): Mifflin-St Jeor from age/height/weight/activity, maintenance + lean-gain target + protein goal. Compare logged meals against it.
- Fitness: a rotating menu of strength-endurance/power sessions for home and outdoors, a daily mobility warm-up slot, and an ankle prehab block. Scaled for an advanced trainee, not beginner.
- Diet: 5-10 default meals with a generated weekly shopping list. Protein-first, low added sugar, lactose-free.
- Personal Eisenhower matrix (life and ideas only, not work). Q1-Q4 sort in code, protect Q2.
- Reframe engine + daily gem, pulling from the knowledge files, attribution shown honestly.

CAMPAIGN ENGINE:
- Support a "campaign," a focused multi-week push. First campaign: sleep-shift + morning routine.
- Sleep-shift stepper: move target wake and bed times earlier in 15-30 min steps, advancing only when the current step holds. Wake-time consistency leads.
- Morning routine: sunlight within 30 min of waking, mobility warm-up, a 90-min block, then training.
- Dinner stepper: move dinner earlier in steps, same logic.
- Keep other systems in maintenance mode during an active campaign so the user isn't fighting five fronts.

SEED DATA:
- Pre-fill the first user (Mark) with the Big Five defaults described in his profile file, and set the active campaign to sleep-shift + morning routine.

DELIVER:
- The full app, the Supabase schema and RLS policies, the Gemini server function, a README with deploy steps for Vercel + Supabase + a Gemini key, and a short note on how a second user signs up and onboards.

Start with auth + a single working account, then the systems engine and daily check-in. Confirm each phase before moving on.
```

Replace the data-model and seed sections with the live `coach-knowledge/your-profile.md` content when you run it, so the seed matches your real config.
