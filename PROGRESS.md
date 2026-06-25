# Build Progress

Quick state of the build so we resume fast.

## Done and working
- Phase 1: Next.js + Supabase auth, login, dashboard (Home), four tables with RLS.
- Phase 2: editable systems engine, daily check-in, history, entry delete, system reordering.
- Phase 3: Gemini coach wired (model gemini-2.5-flash), Big Five seeded.
- Coach 503 handling: retry + fallback model.
- Playbooks built and real (match the clean Diet design): Diet, Sleep, Exercise.
  - Diet: editable targets (maint ~3100, lean-gain ~3350, protein ~170, water), meal menu with custom meals, grouped shopping list, snacks, water tracking.
  - Sleep: wake-time shift stepper, morning-light reminder, reading-anchored wind-down, auto-filled wake/bed.
  - Exercise: editable Ondra warm-up, ankle prehab, session menu, weekly target 1-7, floor + streak tracking.

## In flight (was testing when we paused)
- Design pass: make the editable lists compact (× inline on the row, tighter spacing) and match Diet across Exercise/Sleep.
- Eating window: align meal 3 row, removed "no fasting" wording.
- Coach reformat: new format from coach-persona.md (Verdict, the read, the one move, Tomorrow plan), no all-caps blocks.

## Next up
1. Finish testing the design + coach fixes.
2. Build the last two playbooks to complete the Big Five:
   - Mind: Stoic/reframe practice, daily gem, evening reflection.
   - Morning & schedule: protect pre-3pm hours, personal Eisenhower matrix (life + ventures, no work tasks).
3. Weekly review session.
4. Second user + shared progress + onboarding wizard (for girlfriend).
5. PWA polish + deploy to Vercel (make it live online).

## How to resume
- Open Claude Code (desktop app) in this folder.
- Paste: "Read PROGRESS.md and coach-knowledge/, restart the dev server, and let's continue from Next up."
- Keys are in .env.local. Reminder: rotate the Supabase secret key and Gemini key before going live, since they were shared in chat.
