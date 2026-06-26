# Today Dashboard, Coach, and Goals: Design Spec

Claude Code: build the Today experience to match this exactly. The current version dumps a static plan as a vertical text list and wastes the screen. This replaces that. Match the clean Diet playbook styling (cards, spacing, labels separated from values).

## 1. Layout: a real dashboard that uses the full width

Stop using a single narrow centered column. Desktop is a two-zone dashboard, responsive to one column on mobile.

- **Header (full width):** the date, and the energy control as the headline (energy is the master metric, so make it prominent: a large number or ring you set 1 to 10). Optionally the day's one-line focus next to it.
- **Main area (left, about two thirds):** a responsive grid of cards (2 across on desktop, 1 on mobile). These are the system cards plus the goals card.
- **Coach rail (right, about one third, sticky on scroll):** the coach. Briefing, gem, nudges, Review my day, Ask the coach.
- **Mobile/narrow:** single column; the coach rail drops below the main grid.

No lonely centered column, no large empty side margins.

## 2. System cards (the main grid)

Each of the five systems is one interactive card. The card merges the plan and the logging, so there is no separate "Today's plan" list and no separate check-in. Each card shows:

- The system name and an at-a-glance status (done / floor / skip, or a small progress indicator).
- Today's plan for that system, pulled from code, with labels clearly separated from values. Never render "SleepWake 10:30". Render "Sleep" as a heading, then "Wake 10:30 · Bed 02:30 · Step 2".
- The logging controls inline:
  - Sleep card: wake/bed (prefilled with targets), morning light toggle, wind-down toggle.
  - Training card: today's session from the rotation, warm-up toggle, session done + type, ankle prehab toggle.
  - Diet card: targets, today's meals as tap-to-log, water, quick-add snack, running totals vs target (code).
  - Mind card: today's intention input (one line), and a reframe if the coach flagged one.
  - Schedule card: the morning block, the slot-when-free list, today's fixed rocks.
- A small "Open playbook" link for depth and editing (the playbook is the setup layer).

Cards have consistent padding and clear hierarchy. This is the core fix: five clean interactive cards in a grid, not a vertical wall.

## 3. The dynamic briefing (top of the coach rail)

The briefing must be different every day. It is NOT a recitation of static targets (those live in the cards). It is a short, fresh coaching note built from real signals.

Feed the briefing model these code-computed signals: yesterday's energy and what slipped, the 7-day energy trend, the current sleep-shift step and last wake drift, which training session is due today, whether today is a German day (Tue/Fri), any trend that is off (protein under target lately, sessions behind the weekly count, sleep drifting later), and the single highest-leverage focus for today.

Rules:
- 2 to 4 sentences, coach voice (see coach-persona.md).
- Reference what actually changed or what is off. Tie yesterday to today.
- End with one clear focus for the day, not a list.
- Never invent numbers; read them from the signals provided.

Good briefing (dynamic):
"Energy slid to 5 yesterday on a 2:40 bed, second late night this week. That's the pattern to break. You're on step 2 of the shift, so 10:15 today, no sleeping in. Strength-endurance is up and you're two sessions behind your weekly four, so this one counts. Focus: lights off and book in hand by 1:45."

Bad briefing (static, what we have now, do not do this):
"Hit your 10:30 wake and 02:30 bed. Get morning light, run the Ondra warm-up, eat 3350 calories..." Same every day.

## 4. Coach rail contents (right column, sticky)

In order:
1. The dynamic briefing.
2. Today's gem (varies daily, honest attribution).
3. Time-aware nudges (computed from the clock and targets: morning-light window, wind-down soon, pull dinner earlier).
4. Review my day button (evening, auto-runs after a set hour). Output in the clean format: verdict, the read across all systems, the one move, tomorrow's plan, plus a reflection input.
5. Ask the coach button (quick question anytime).

## 5. Goals: a quarter calendar (new)

A Goals view, its own page, plus a compact card on the Today grid. This is NOT the Eisenhower matrix; keep Eisenhower separate in the Schedule playbook for task triage. Goals are direction and progress over time.

- **Quarter calendar:** the year laid out as quarters (Q1 to Q4), as columns or a horizontal timeline. Goals sit in the quarter they are targeted for.
- **Each goal:** title, a why (tie to my vision), target quarter, a progress bar, notes, and optional milestones.
- **Progress is derived in code where a goal links to a system:** a wake-time goal reads the sleep-shift step, a strength/muscle goal reads sessions-per-week and weight, a diet goal reads adherence. Goals with no system link use manual status or milestones.
- **Interactive:** add a goal, move it between quarters, update progress and notes, mark milestones.
- **On Today:** a compact Goals card in the grid showing the top 2 to 3 goals with progress bars, linking to the full quarter calendar.
- The coach occasionally ties the day to a goal and flags a goal that has not moved in a while.

Keep the chain clear: Vision (pinned in Mind) leads to Goals (direction and progress) leads to Eisenhower tasks (triage) leads to daily systems (execution).

## 6. Visual standards (apply everywhere)

- Use the full width. Grids, not a single column.
- Cards with consistent padding; labels always separated from values.
- Match the Diet playbook's card style, spacing, and typography.
- No walls of text. Break content into cards and short blocks.
- The page should read like a clean dashboard, not a form.

## 7. What stays in code vs the AI

- Code: the whole plan, all targets and totals, streaks, nudge timing, goal progress, the quarter math, the sleep-shift step.
- AI: the briefing narrative, the daily review, the reframe wording, answers to Ask the coach. The AI reads numbers from code and never computes or invents them.
