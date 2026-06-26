# Today: Simple, Calm, Progressive Disclosure (v2)

This replaces the previous dense dashboard. The old version showed every control at once and overwhelmed. This is the opposite, and it follows how the best apps actually work.

Grounding (real patterns): Fitbit cut its main screen to three metrics and saw about 30% more daily active users. Streaks lets you tap habits off in seconds. The consistent rule in habit and wellness apps is progressive disclosure: show only what matters, hide the rest behind a tap. This is Adams' "simplify, don't optimize," finally applied.

Match the clean Diet card styling for any expanded content.

## The default Today view (calm, single column)

A single comfortable centered column, not a wide multi-column cockpit. When I open Today I see only:

1. **Header:** the date with day navigation (a left and right arrow to move to past or other days and edit them, plus a "Today" button to jump back), the energy headline (the one master metric, set with a tap or slider), and today's one-line focus.
2. **The coach briefing:** one short, calm card. 2 to 4 sentences (dynamic, rules below), ending in the single focus for the day. A small "Show today's plan" toggle expands the full plan (sleep target, due session, meals, targets) only if I want it. Collapsed by default.
3. **The systems as a checklist of collapsed rows.** Each system is one row showing its name, an at-a-glance status (a dot or check: done / floor / skip / not yet), and one glance value where useful (e.g. Diet shows 1750 / 3000 ml). Tapping a row expands it inline to reveal that system's quick log (the toggles, meals, water). Collapsed by default, so the default screen is about five tidy rows, not five walls of controls.
4. **A compact Goals row** that links to the Goals page (built next).
5. **Two buttons: "Review my day" and "Ask the coach."** The evening review and the ask box open on demand in a panel or modal. They are NOT an always-open column of text.

That is the entire default screen: energy, a short briefing, five rows, a goals row, two buttons. Calm.

## Logging is fast and optional

- Tap a row to expand, tick what you did, collapse. Seconds, not a form.
- Nothing is required. A whole system can be marked done with one tap on its status control, without expanding.
- Energy is the one thing always visible and always one tap to set.

## Day navigation (bring this back)

The left/right day arrows and a "Today" button return. I can move to a previous day and edit that entry. This existed before the refactor and I want it back.

## The coach: on demand, not a wall

- Morning: the short briefing card is the only always-visible coach text.
- Evening: "Review my day" opens the review (verdict, the read, the one move, tomorrow's plan) in a panel or modal, with the reflection input there. It can still auto-open in the evening, but as a panel, not a permanent column.
- "Ask the coach" opens a quick question box on demand.
- The daily gem is a small line (in the briefing card footer), not a big block.

## Light time-phasing (optional, keep subtle)

If it helps, group the rows under a small "Morning" and "Evening" label (morning: sleep, light, warm-up, intention; evening: training, diet, reflection). Keep it a light grouping, not two heavy sections.

## Keep unchanged from the working version

- **The dynamic briefing rules:** built from code-computed signals (yesterday's energy and what slipped, the 7-day trend, the sleep-shift step and last wake drift, today's due session, whether it is a German day, any off-track trend like protein under or sessions behind), and it ends with one focus. It changes daily and never just recites static targets.
- **Code does all numbers:** the plan, targets, totals, streaks, nudge timing, goal progress, the sleep step. The AI only narrates the briefing, the review, and the ask. It never invents numbers.

## What we are deliberately NOT doing

No wide multi-column cockpit with every control visible at once. We tried that and it overwhelmed. Calm and collapsed beats dense and complete. If in doubt, show less.
