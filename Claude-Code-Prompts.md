# Claude Code Build Prompts

Paste these into Claude Code in order. Each one is a phase. Confirm the build works before moving to the next.

## Before you start

You don't upload files into Claude Code the way you do in a chat. Claude Code reads the folder it runs in. So:

1. Put this whole folder on your computer (keep `Build-Plan.md` and the `coach-knowledge/` folder together).
2. Open a terminal in this folder and start Claude Code there.
3. The prompts below reference the files by name. Claude Code reads them straight from the repo, so you never paste the long spec.

### Accounts and keys you'll need (all free)

- Node.js installed.
- A Supabase account, and a new empty Supabase project (gives you the database, auth, and two connection keys).
- A Google Gemini API key from Google AI Studio (free tier, no card).
- A Vercel account for deploy (later, at Phase 7).

Have the Supabase URL and keys and the Gemini key ready in a notepad. Claude Code will ask you to drop them into a `.env.local` file.

### How to correct it if it drifts

If it builds something wrong, don't let it pile on. Say: "Stop. That doesn't match Build-Plan.md section X. Re-read it and fix before continuing." The spec is the referee.

Commit to git after every phase that works, so you can always roll back.

---

## Prompt 0: Orient (no code yet)

```
Read Build-Plan.md and every file in coach-knowledge/ in this repo, start to finish, before doing anything.

Then, without writing code yet:
1. Summarize the app in 5 bullet points so I know you understand it.
2. State the stack and the single most important rule (code does exact math, AI only coaches).
3. List the phases you'll build, matching Build-Plan.md section 12.
4. Tell me exactly what accounts, keys, and env vars you need from me.

Wait for my go-ahead before Phase 1.
```

---

## Prompt 1, Phase 1: scaffold, database, auth, one account

```
Build Phase 1 from Build-Plan.md.

- Scaffold a Next.js app (App Router, TypeScript).
- Set up Supabase: create the schema from section 11 (users, systems, entries, friendships) with row-level security so a user only sees their own rows for now.
- Email/password auth. I can sign up, log in, log out.
- A bare dashboard shell that shows my name once I'm logged in.
- Create .env.local with placeholders and tell me exactly which values to paste.

Keep it minimal. No styling rabbit holes. Confirm I can sign up and log in before we continue.
```

---

## Prompt 2, Phase 2: editable systems engine + daily check-in

```
Build Phase 2 from Build-Plan.md.

- The editable systems engine (section 3): full create, edit, archive, delete on "systems" from the UI. A system has name, domain, rule, floor, ceiling, metric_type, anchor, schedule_block, active.
- The daily check-in (section 8): energy slider 1-10, tap each active system as done/floored/skipped, a meals field, one-line note, evening reflection, tomorrow's next action. Saves to the entries table.
- A simple Today screen and a Systems settings screen.

No AI yet. Just make logging fast and saving reliable. The whole check-in should take under 5 minutes.
```

---

## Prompt 3, Phase 3: seed my Big Five + the grounded coach

```
Build Phase 3 from Build-Plan.md.

First, seed my account with the Big Five default systems described in coach-knowledge/your-profile.md and Build-Plan.md section 5, and set my active campaign to sleep-shift + morning routine.

Then add the coach:
- A Vercel-style server function that calls Google Gemini (free Flash), with the API key server-side only. Isolate this in one module so the provider can be swapped later.
- Before each call, load coach-persona.md, adams-doctrine.md, reframes-library.md, daily-wisdom.md, and my profile as system context.
- Daily review output: a 30-second read of the day plus one correction for tomorrow plus the next morning's plan. Short and structured, per the persona file.
- Enforce the hard rule: the coach reads numbers from the app data passed in, it never calculates or invents them.

Show me a real daily review after I submit a check-in.
```

---

## Prompt 4, Phase 4: the sleep-shift campaign engine (ship point)

```
Build Phase 4 from Build-Plan.md section 7, the campaign engine.

- A "campaign" is a focused multi-week push. Build the sleep-shift + morning routine campaign.
- Sleep-shift stepper (code, not AI): move my target wake and bed times earlier in 15-30 minute steps, advancing only when the current step holds for several days. Wake-time consistency leads.
- Morning routine block: sunlight within 30 minutes of waking, the Adam Ondra warm-up, a 90-minute block, then training.
- Dinner stepper: move my dinner time earlier in steps, same logic.
- The coach references the current step in the daily review and holds me to it.
- Keep my other systems in maintenance mode while this campaign is active.

This is the ship point. After this works, I should be able to use it daily.
```

---

## Prompt 5, Phase 5: calorie calculator + fitness and diet modules

```
Build Phase 5 from Build-Plan.md section 6.

- Calorie/macro calculator in CODE: Mifflin-St Jeor from my age (22), height (188cm), weight (88kg), and activity. Output maintenance, a lean-gain target (+250), and a protein goal (~170g). Compare my logged meals against it. Do not let the AI compute these.
- Fitness module: a rotating menu of strength-endurance and power sessions for home and outdoors, scaled for an advanced trainee (ex-powerlifter, not beginner), plus a daily mobility warm-up slot and a left-ankle prehab block.
- Diet module: 5-10 default meals built from Vienna groceries (Hofer, Billa, Spar) and air-fryer-fast prep, protein-first, low added sugar, lactose-free. Meals condensed into a tighter eating window (no fasting), front-loaded earlier in the day, last meal well before bed. Generate a weekly shopping list from the menu.
```

---

## Prompt 6, Phase 6: weekly review, reframes, daily gem, personal Eisenhower

```
Build Phase 6 from Build-Plan.md.

- Weekly review session the coach walks me through: which systems are automatic vs willpower, one to shrink/move/cut, energy-habit correlation, and the next step in the sleep campaign. Let me pick the day.
- Reframe engine: when my check-in shows negative self-talk, the coach offers a reframe from reframes-library.md (old frame, new frame, the cue to repeat it).
- Daily gem: one quote a day from daily-wisdom.md, attribution shown honestly, rotated so it doesn't repeat for a couple of weeks.
- Personal Eisenhower matrix for life and new-venture ideas only (no work tasks). Q1-Q4 sort in code, protect Q2.
```

---

## Prompt 7, Phase 7: second user, shared progress, friend onboarding

```
Build Phase 7 from Build-Plan.md section 9.

- Support a second user with their own account, systems, and entries.
- Friendships table with row-level security so two linked users see each other's non-private progress (energy trend, streaks, adherence) and nothing else. Journal and notes stay private with a per-entry share toggle.
- Onboarding wizard for any new user: they answer the intake (energy, schedule, vision, sleep, diet, fitness, constraints, coaching prefs, failure modes). The AI proposes a starting Big Five and a draft schedule from their answers, which they edit before saving.
- A light shared view where my friend and I can see each other's progress. Not a feed.
```

---

## Prompt 8, Phase 8: PWA polish and deploy

```
Build Phase 8 from Build-Plan.md.

- Make it an installable PWA so it sits on my phone home screen and runs the same on my laptop, data synced through Supabase.
- Responsive layout, clean and fast.
- Walk me through deploying to Vercel and connecting Supabase and the Gemini key as environment variables.
- Give me a short note I can send my friend on how to sign up and onboard.
```

---

## After it's live

Run it for two weeks on the sleep campaign before adding anything. If a system creates friction, edit it or cut it from inside the app. That's the whole point of making systems editable. Tell the coach what's not working and let it propose the change.
