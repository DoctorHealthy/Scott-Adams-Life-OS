# Scott Adams Life OS

Personal life operating system for Mark, built on Scott Adams' philosophy. A directive AI coach plus an editable systems engine. Not a habit tracker.

## Read these before building
- `MASTER-BUILD-SPEC.md` — the full product spec and the build plan. Read it first, every session.
- `Today-Design-Spec.md` — the daily screen design (v2 + v2.1).
- `coach-knowledge/` — the coach's brain: persona, doctrine, reframes, daily wisdom, and Mark's profile. Load these as context for any coach feature.
- `system-playbooks/` — the real content for each system (diet, sleep, exercise, mind, morning & schedule).
- `PROGRESS.md` — current state and history.

## Hard rules
- Code does everything exact: all numbers, dates, streaks, totals, progress, correlations, the sleep-shift step. The AI only coaches (briefing, reviews, reframes, answers) and reads numbers from code. It never computes or invents a number.
- Simplify. Progressive disclosure, calm single column, show little, reveal on tap. If a screen looks busy, it is wrong.
- Do not regress working features. Follow Explore, Plan, Implement, Commit. Verify every milestone (type-check, build, manual test) before moving on.
- Coach voice: hardcore, directive, tight. No emojis, no em dashes, no filler.

## Stack
Next.js (App Router, TypeScript) + Tailwind, Supabase (Postgres, auth, RLS), Google Gemini (`gemini-2.5-flash`) via a server route, deploy to Vercel, installable PWA. Keys are in `.env.local`. Mark runs the dev server himself in his terminal (`npm.cmd run dev`); do not fight background server processes.
