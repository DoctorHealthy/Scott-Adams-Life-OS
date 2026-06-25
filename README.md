# Scott Adams Life OS

Everything for building your personal Life OS, in one folder.

## What's here

- `Build-Plan.md`: the full spec. Architecture, the editable systems engine, your personalized Big Five, the coach, the two-user setup, the modules, and the first campaign. This is the source of truth.
- `Claude-Code-Prompts.md`: the step-by-step prompts to paste into Claude Code, in order, to build the app. Start here when you're ready to build.
- `coach-knowledge/`: the AI coach's brain. Keep this folder inside the app repo. The app loads these before the coach speaks.
  - `coach-persona.md`: how the coach thinks and talks (hardcore, directive, strategic).
  - `adams-doctrine.md`: the core doctrine (systems, energy, Big Five, the diet system, talent stack).
  - `reframes-library.md`: Adams reframes plus ones tuned to you.
  - `daily-wisdom.md`: the Stoic and philosopher gem pool, honest attribution.
  - `your-profile.md`: you. Stats, schedule, sleep, diet, fitness, vision, coaching prefs. The coach reads this so it never gives generic advice.

## How to use it

1. Download this whole folder to your computer.
2. Open `Claude-Code-Prompts.md` and follow it top to bottom.
3. The prompts tell Claude Code to read `Build-Plan.md` and the `coach-knowledge/` files, so you don't paste long specs. The files travel with the repo.

## The one rule that keeps it from making mistakes

Code does everything exact (calorie math, schedules, streaks, dates). The AI only coaches. It reads numbers from the app and never computes them. If you ever see the coach invent a number, that's a bug, not a design choice.
