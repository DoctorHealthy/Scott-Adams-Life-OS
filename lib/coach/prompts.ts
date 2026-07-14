import type { Entry, System, SystemStatus } from "@/lib/types";
import { prettyDate, STATUS_META } from "@/lib/constants";

type ProfileLike = {
  name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  constraints: Record<string, unknown> | null;
  coaching_prefs: Record<string, unknown> | null;
};

type RecentEntry = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
};

// Task framing appended to the knowledge base. Enforces the output shape and
// the hard rule: the model reads the app's numbers, it never computes them.
export const DAILY_REVIEW_TASK = `
=====  YOUR TASK NOW: DAILY REVIEW  =====
Run the daily review off the DATA block below. It is the only source of truth.

HARD RULES
- Every number you state comes from the DATA block. Never compute, estimate, or
  invent a number (energy, calories, protein, water, times, streaks). If something
  is missing, say "not logged".
- Be aware of all of the user's active systems: sleep, diet, exercise, mind, and
  schedule. The read connects them, grounded in the real numbers. Do not just list
  them, and do not ignore mind or schedule.
- MISSES: the DATA lists what was missed today, each with surrounding facts. For
  the misses you address you must do two things: (a) name the likely why using
  ONLY those facts (for example, session skipped after a 2:40 bed and energy 4),
  and (b) give a concrete reversal for tomorrow: an exact action, an exact time,
  an exact adjustment. Never vague. Not "try to sleep earlier" but "lights off,
  book in hand at 01:30, phone on the charger across the room, wake stays 10:15."
  If there are more than 2 misses, do this fully for the 2 highest-leverage ones
  and name the rest in a single line.
- PATTERNS: if the DATA lists an energy pattern that is relevant to today, use it
  in the read (one line, plain language). Quote it; never derive new patterns.
- VISION AND GOALS: only when the data gives a reason (a goal moved, a goal is
  flagged stale, or today's work clearly served one), tie the day to a goal or
  the vision in one line. Do not do this every day. If a goal is flagged stale,
  call it out and attach the smallest next move.
- Persona: hardcore, directive, strategic, tight. No filler, no preamble, no
  emojis, no em dashes, no double dashes. Reads numbers, never computes them.
- Respect the user's constraints (see profile).

FORMAT, exactly this, plain text only. No markdown symbols, no all-caps headers.
Use the small lowercase-style labels shown.

Verdict: one punchy line naming the single most important thing about today.

Then a blank line, then the read with NO label: 2 to 5 tight sentences in your
voice, connecting the systems and grounded in the numbers. This is where the
miss diagnosis lives: the why for each miss you address, from the listed facts.

Move: the single highest-leverage correction for tomorrow, one line, concrete
(exact action, exact time).

Tomorrow:
Then 2 to 4 morning time blocks, one per line, formatted "07:30  block, short
reason", grounded in today's data. Reversals from the misses go here as real
blocks (for example anchor the first block to morning light if it was missed).

Reframe: include this line ONLY if the user's one-line or reflection shows negative
self-talk. Format "old frame -> new frame. Repeat it when <cue>."

Keep the whole thing under 300 words. Orders, not essays.
`.trim();

function fmtConstraints(c: Record<string, unknown> | null): string {
  if (!c || Object.keys(c).length === 0) return "none recorded";
  return Object.entries(c)
    .map(([k, v]) => (v === true ? k : `${k}: ${String(v)}`))
    .join(", ");
}

type DietNumbers = {
  ok: boolean;
  targetKcal: number | null;
  targetProtein: number | null;
  loggedKcal: number;
  loggedProtein: number;
  waterMl: number;
  waterTargetMl: number | null;
};

type SleepNumbers = {
  targetWake: string;
  targetBed: string;
  latestWake: string | null;
  driftMin: number | null;
  holdStreak: number;
  holdDays: number;
  eligible: boolean;
  nextWake: string;
  atGoal: boolean;
  windDownToday: boolean;
  morningLightToday: boolean;
};

type ExerciseNumbers = {
  sessionsLast7: number;
  sessionsTarget: number;
  floorStreak: number;
  warmupToday: boolean;
  sessionToday: boolean;
  sessionTypeToday: string | null;
  ankleToday: boolean;
};

type MissLike = { what: string; context: string[] };
type GoalLine = { title: string; progress: number; staleDays: number | null };

export function buildDailyReviewPrompt(args: {
  profile: ProfileLike | null;
  systems: System[];
  entry: Entry;
  recent: RecentEntry[];
  date: string;
  diet: DietNumbers;
  sleep: SleepNumbers;
  exercise: ExerciseNumbers;
  intention: string | null;
  misses: MissLike[];
  correlations: CorrelationLike[];
  vision: string;
  goals: GoalLine[];
}): string {
  const {
    profile,
    systems,
    entry,
    recent,
    date,
    diet,
    sleep,
    exercise,
    intention,
    misses,
    correlations,
    vision,
    goals,
  } = args;

  // ---- numbers computed in code; the model only reads them ----
  const statuses = entry.system_statuses ?? {};
  const counts = { done: 0, floor: 0, skip: 0, not_logged: 0 };
  const systemLines = systems.map((s) => {
    const st = statuses[s.id] as SystemStatus | undefined;
    if (st) counts[st] += 1;
    else counts.not_logged += 1;
    const label = st ? STATUS_META[st].label : "not logged";
    return `- ${s.name} [${s.domain ?? "Custom"}]: ${label}`;
  });

  const energiesLogged = recent
    .filter((r) => r.energy_1_10 != null)
    .map((r) => r.energy_1_10 as number);
  const avg7 =
    energiesLogged.length > 0
      ? (
          energiesLogged.reduce((a, b) => a + b, 0) / energiesLogged.length
        ).toFixed(1)
      : "not logged";

  const recentLines = recent
    .map((r) => `- ${r.date}: energy ${r.energy_1_10 ?? "not logged"}`)
    .join("\n");

  const p = profile;
  const profileBlock = p
    ? [
        `Name: ${p.name ?? "unknown"}`,
        `Age: ${p.age ?? "not set"}, Height: ${p.height_cm ?? "not set"} cm, Weight: ${p.weight_kg ?? "not set"} kg`,
        `Activity level: ${p.activity_level ?? "not set"}`,
        `Constraints: ${fmtConstraints(p.constraints)}`,
      ].join("\n")
    : "Profile not set.";

  return `
=====  DATA (computed by the app; treat as exact, do not recompute)  =====

USER PROFILE
${profileBlock}

DAY UNDER REVIEW: ${date} (${prettyDate(date)})

ENERGY
- Today's energy (1-10): ${entry.energy_1_10 ?? "not logged"}
- Last ${recent.length} logged days, most recent first:
${recentLines || "- none"}
- Average energy across logged days in that window: ${avg7}

SYSTEMS TODAY (status the user tapped)
${systemLines.length ? systemLines.join("\n") : "- no active systems"}
- Tally: ${counts.done} done, ${counts.floor} min, ${counts.skip} skip, ${counts.not_logged} not logged

DIET TODAY (computed by the app from the meals the user logged)
${
  diet.ok
    ? `- Calories logged: ${diet.loggedKcal} of ${diet.targetKcal ?? "not set"} target (${
        diet.targetKcal != null ? diet.targetKcal - diet.loggedKcal : "?"
      } kcal under)
- Protein logged: ${diet.loggedProtein} g of ${diet.targetProtein ?? "not set"} g target (${
        diet.targetProtein != null ? diet.targetProtein - diet.loggedProtein : "?"
      } g under)
- Water: ${diet.waterMl} ml of ${diet.waterTargetMl ?? "not set"} ml target`
    : `- Calorie targets not computable (profile stats missing). Water: ${diet.waterMl} ml of ${diet.waterTargetMl ?? "not set"} ml. Do not guess the calorie numbers.`
}

SLEEP (computed by the app; the active campaign)
- Target wake ${sleep.targetWake}, target bed ${sleep.targetBed}
- Last logged wake: ${sleep.latestWake ?? "not logged"}${
    sleep.driftMin != null
      ? ` (${sleep.driftMin > 0 ? `${sleep.driftMin} min late` : sleep.driftMin < 0 ? `${-sleep.driftMin} min early` : "on target"})`
      : ""
  }
- Hold streak: ${sleep.holdStreak} of ${sleep.holdDays} needed to advance${
    sleep.atGoal
      ? " (already at goal wake)"
      : sleep.eligible
        ? ` (eligible: advance to ${sleep.nextWake})`
        : ""
  }
- Today: wind-down ${sleep.windDownToday ? "done" : "not done"}, morning light ${sleep.morningLightToday ? "done" : "not done"}

EXERCISE (computed by the app)
- Sessions last 7 days: ${exercise.sessionsLast7} of ${exercise.sessionsTarget} target
- Floor streak: ${exercise.floorStreak} days
- Today: warm-up ${exercise.warmupToday ? "done" : "not done"}, session ${
    exercise.sessionToday
      ? `done (${exercise.sessionTypeToday ?? "type not set"})`
      : "not done"
  }, ankle prehab ${exercise.ankleToday ? "done" : "not done"}

MISSES TODAY (detected by the code; diagnose the why from the facts, then give
the concrete reversal per the rules)
${
  misses.length
    ? misses
        .map((m) => `- ${m.what}\n  facts: ${m.context.join("; ") || "none recorded"}`)
        .join("\n")
    : "- none detected; the day held"
}

ENERGY PATTERNS (last 14 days, computed; quote, never derive your own)
${
  correlations.length
    ? correlations
        .map(
          (c) =>
            `- ${c.name}: energy ${c.energyOn} on done days (${c.daysOn}d) vs ${c.energyOff} otherwise (${c.daysOff}d), gap ${c.gap > 0 ? "+" : ""}${c.gap}`
        )
        .join("\n")
    : "- none strong enough to report"
}

VISION AND GOALS (tie in only when the data gives a reason)
- Vision: ${vision}
${
  goals.length
    ? goals
        .map(
          (g) =>
            `- ${g.title}: ${g.progress}%${
              g.staleDays != null && g.staleDays >= 14
                ? ` (STALE: no movement in ${g.staleDays} days)`
                : ""
            }`
        )
        .join("\n")
    : "- no active goals"
}

THE USER'S OWN WORDS TODAY
- Morning intention: ${intention ?? "not set"}
- Evening reflection: ${entry.reflection ?? "not logged"}

=====  END DATA  =====

Now produce the DAILY REVIEW exactly as instructed above.
`.trim();
}

// ---------- Morning briefing ----------

export const BRIEFING_TASK = `
=====  YOUR TASK NOW: DAILY BRIEFING  =====
Write a short, fresh coaching note for today, in your voice, from the SIGNALS
block below. The signals are computed by the app; treat every number as exact and
never invent one.

This is NOT a recitation of static targets (those live in the cards on the page).
It is a coaching note that reacts to what actually changed.

RULES
- 2 to 4 sentences. Coach voice: hardcore, directive, tight. No filler, no emojis,
  no em dashes, no double dashes.
- Tie yesterday to today. Lead with what changed or what is off (energy move, a
  slip, a drift, being behind on sessions, protein under). Reference the real
  signals.
- Mention the sleep step and today's wake target only if it is the lever today.
  Note any fixed commitments today when they matter for the plan.
- End with ONE clear focus for today, not a list.
- It must read differently on a different day. Never invent numbers.

Plain text, no markdown symbols, no headers.
`.trim();

type BriefingSignalsLike = {
  name: string;
  fixedToday: string[];
  yesterday: { logged: boolean; energy: number | null; slipped: string[] };
  energy7: { avg: number | null; direction: string; count: number };
  sleep: {
    stepNumber: number;
    currentWake: string;
    targetBed: string;
    lastWake: string | null;
    driftMin: number | null;
    holdStreak: number;
    eligible: boolean;
    atGoal: boolean;
  };
  training: {
    sessionDue: string;
    sessionsLast7: number;
    sessionsTarget: number;
    floorStreak: number;
    behind: boolean;
  };
  diet: { proteinAvg: number | null; proteinTarget: number | null; proteinUnder: boolean };
};

export function buildBriefingPrompt(signals: BriefingSignalsLike): string {
  const s = signals;
  const slipped = s.yesterday.slipped.length
    ? s.yesterday.slipped.join(", ")
    : "nothing flagged";
  const drift =
    s.sleep.driftMin == null
      ? "no wake logged"
      : s.sleep.driftMin > 0
        ? `${s.sleep.driftMin} min late`
        : s.sleep.driftMin < 0
          ? `${-s.sleep.driftMin} min early`
          : "on target";

  return `
=====  SIGNALS (computed by the app; exact, do not change)  =====

Name: ${s.name}
Fixed commitments today: ${s.fixedToday.length ? s.fixedToday.join(", ") : "none"}

YESTERDAY
- Logged: ${s.yesterday.logged ? "yes" : "no"}
- Energy: ${s.yesterday.energy ?? "not logged"}
- Slipped (min or skip): ${slipped}

ENERGY TREND
- Last ${s.energy7.count} logged days average: ${s.energy7.avg != null ? s.energy7.avg.toFixed(1) : "not logged"}
- Direction: ${s.energy7.direction}

SLEEP SHIFT
- On step ${s.sleep.stepNumber}, today's wake target ${s.sleep.currentWake}, bed ${s.sleep.targetBed}
- Last logged wake: ${s.sleep.lastWake ?? "not logged"} (${drift})
- Hold streak: ${s.sleep.holdStreak}${s.sleep.atGoal ? " (at goal)" : s.sleep.eligible ? " (eligible to advance)" : ""}

TRAINING
- Session due today: ${s.training.sessionDue}
- Sessions last 7 days: ${s.training.sessionsLast7} of ${s.training.sessionsTarget}${s.training.behind ? " (behind)" : ""}
- Daily floor streak: ${s.training.floorStreak}

DIET
- Protein recent average: ${s.diet.proteinAvg != null ? Math.round(s.diet.proteinAvg) : "not logged"} g of ${s.diet.proteinTarget ?? "not set"} g target${s.diet.proteinUnder ? " (running under)" : ""}

=====  END SIGNALS  =====

Now write today's briefing exactly as instructed above.
`.trim();
}

// ---------- Weekly review ----------

export const WEEKLY_REVIEW_TASK = `
=====  YOUR TASK NOW: WEEKLY REVIEW  =====
Run the weekly review off the DATA block below. It is the only source of truth.

HARD RULES
- Every number you state comes from the DATA block. Never compute, estimate, or
  invent one (energy, adherence counts, correlations, streaks, wake times, goal
  percentages). If something is missing, say "not logged".
- The correlations in the DATA are already computed. Quote them; do not derive
  new ones or claim a pattern the data does not show.
- Persona: hardcore, directive, strategic, tight. No filler, no preamble, no
  emojis, no em dashes, no double dashes.
- Respect the user's constraints (see profile).

FORMAT, exactly this, plain text only. No markdown symbols, no all-caps headers.
Use the small lowercase-style labels shown.

Verdict: one punchy line naming the week's single most important truth.

Then a blank line, then the read with NO label: 3 to 5 tight sentences.
Name which systems ran on autopilot and which still needed willpower (use the
counts). Call out the strongest energy-to-habit correlation in plain language
(for example, energy runs higher on training days). Note goal movement if any
goal moved.

Cut or shrink: name the one system to shrink, move, or cut this week. Diagnose
the why from the counts (root cause, not judgment), then the exact change: what
it becomes, when it happens. Two or three lines.

Campaign: one line on the sleep-shift step. If eligible to advance, say to
advance to the next wake target; if not, say to keep holding the current wake.

Goals: if any goal is flagged STALE in the DATA, one line naming it and the
smallest next move. If none are stale, skip this section entirely.

Next week: 2 to 3 orders for the coming week, one per line, each tied to the
data above and each concrete (exact action, exact time or day).

Keep the whole thing under about 300 words. Orders, not essays.
`.trim();

type SystemWeekLike = {
  name: string;
  done: number;
  floor: number;
  skip: number;
  notLogged: number;
  label: "autopilot" | "willpower" | "attention";
};

type CorrelationLike = {
  name: string;
  energyOn: number;
  energyOff: number;
  gap: number;
  daysOn: number;
  daysOff: number;
};

type GoalWeekLike = {
  title: string;
  progress: number;
  delta: number | null;
  linked: boolean;
  staleDays?: number | null;
};

type WeeklyStatsLike = {
  start: string;
  end: string;
  daysLogged: number;
  energy: {
    avg: number | null;
    min: number | null;
    max: number | null;
    direction: string;
    count: number;
  };
  systems: SystemWeekLike[];
  correlations: CorrelationLike[];
  candidate: { name: string } | null;
  sleep: {
    stepNumber: number;
    currentWake: string;
    targetBed: string;
    holdStreak: number;
    holdDays: number;
    eligible: boolean;
    nextWake: string;
    atGoal: boolean;
    latestWake: string | null;
    driftMin: number | null;
  };
  goals: GoalWeekLike[];
};

export function buildWeeklyReviewPrompt(args: {
  profile: ProfileLike | null;
  stats: WeeklyStatsLike;
}): string {
  const { profile, stats: s } = args;

  const p = profile;
  const profileBlock = p
    ? [
        `Name: ${p.name ?? "unknown"}`,
        `Constraints: ${fmtConstraints(p.constraints)}`,
      ].join("\n")
    : "Profile not set.";

  const systemLines = s.systems
    .map(
      (x) =>
        `- ${x.name}: ${x.done} done, ${x.floor} min, ${x.skip} skip, ${x.notLogged} not logged  [${x.label}]`
    )
    .join("\n");

  const corrLines = s.correlations.length
    ? s.correlations
        .map(
          (c) =>
            `- ${c.name}: energy ${c.energyOn} on done days (${c.daysOn}d) vs ${c.energyOff} on other days (${c.daysOff}d), gap ${c.gap > 0 ? "+" : ""}${c.gap}`
        )
        .join("\n")
    : "- none strong enough to report this week";

  const goalLines = s.goals.length
    ? s.goals
        .map(
          (g) =>
            `- ${g.title}: ${g.progress}%${
              g.delta == null
                ? " (baseline, no prior review)"
                : g.delta === 0
                  ? " (no change)"
                  : ` (${g.delta > 0 ? "+" : ""}${g.delta} pts since last review)`
            }${g.linked ? " [from systems]" : " [manual]"}${
              g.staleDays != null && g.staleDays >= 14
                ? ` (STALE: no movement in ${g.staleDays} days)`
                : ""
            }`
        )
        .join("\n")
    : "- no active goals";

  const drift =
    s.sleep.driftMin == null
      ? "no wake logged"
      : s.sleep.driftMin > 0
        ? `${s.sleep.driftMin} min late`
        : s.sleep.driftMin < 0
          ? `${-s.sleep.driftMin} min early`
          : "on target";

  return `
=====  DATA (computed by the app; treat as exact, do not recompute)  =====

USER PROFILE
${profileBlock}

WEEK UNDER REVIEW: ${s.start} to ${s.end} (${s.daysLogged} of 7 days logged)

ENERGY
- Average: ${s.energy.avg ?? "not logged"} (over ${s.energy.count} logged days)
- Range: ${s.energy.min ?? "?"} to ${s.energy.max ?? "?"}
- Direction across the week: ${s.energy.direction}

SYSTEM ADHERENCE (status counts over the 7 days; label is the code's read)
${systemLines || "- no active systems"}

ENERGY-TO-HABIT CORRELATIONS (computed; quote these, do not invent others)
${corrLines}

ONE SYSTEM TO RECONSIDER (flagged by the code as the weakest this week)
- ${s.candidate ? s.candidate.name : "none flagged; adherence held"}

SLEEP-SHIFT CAMPAIGN
- On step ${s.sleep.stepNumber}, current wake target ${s.sleep.currentWake}, bed ${s.sleep.targetBed}
- Latest logged wake: ${s.sleep.latestWake ?? "not logged"} (${drift})
- Hold streak: ${s.sleep.holdStreak} of ${s.sleep.holdDays} needed${
    s.sleep.atGoal
      ? " (already at goal wake)"
      : s.sleep.eligible
        ? ` (eligible: advance to ${s.sleep.nextWake})`
        : " (keep holding)"
  }

GOAL MOVEMENT
${goalLines}

=====  END DATA  =====

Now produce the WEEKLY REVIEW exactly as instructed above.
`.trim();
}

// ---------- Monthly review ----------

export const MONTHLY_REVIEW_TASK = `
=====  YOUR TASK NOW: MONTHLY REVIEW  =====
Run the monthly zoom-out off the DATA block below. It is the only source of
truth.

HARD RULES
- Every number you state comes from the DATA block. Never compute, estimate, or
  invent one. If something is missing, say "not logged".
- The month-versus-last-month deltas are already in the DATA. Quote them; do not
  derive your own.
- Persona: hardcore, directive, strategic, tight. No filler, no preamble, no
  emojis, no em dashes, no double dashes.
- Respect the user's constraints (see profile).

FORMAT, exactly this, plain text only. No markdown symbols, no all-caps headers.

Verdict: one punchy line naming the month's single most important truth.

Then a blank line, then the read with NO label: 3 to 6 tight sentences on the
month's trends: energy, sleep consistency, system adherence, protein, weight.
Anchor each claim to the numbers. Where last month's numbers exist, say what
changed and in which direction.

Goals: one line per goal with its progress and movement. If a goal has not
moved or is flagged STALE, say so plainly and attach the smallest next move.

Lever: the single biggest lever for next month, two or three lines. One lever,
not a list. Name the root cause it corrects (from the numbers), then the exact
behavior, when it happens, and what number it should move.

Keep the whole thing under about 300 words. A clean, keepable summary.
`.trim();

type MonthNumbersLike = {
  daysLogged: number;
  daysInWindow: number;
  energyAvg: number | null;
  energyCount: number;
  sleepConsistencyPct: number | null;
  wakesLogged: number;
  adherencePct: number | null;
  proteinAvg: number | null;
  proteinDaysHit: number;
  proteinDaysLogged: number;
  weightFirst: number | null;
  weightLast: number | null;
};

type MonthlyStatsLike = {
  start: string;
  end: string;
  month: MonthNumbersLike;
  prev: MonthNumbersLike | null;
  prevLabel: string | null;
  systems: {
    name: string;
    done: number;
    floor: number;
    skip: number;
    ranPct: number | null;
  }[];
  goals: {
    title: string;
    progress: number;
    delta: number | null;
    linked: boolean;
    staleDays?: number | null;
  }[];
};

function fmtMonthNumbers(m: MonthNumbersLike): string {
  const weight =
    m.weightFirst != null && m.weightLast != null
      ? `${m.weightFirst} kg to ${m.weightLast} kg (${
          Math.round((m.weightLast - m.weightFirst) * 10) / 10 >= 0 ? "+" : ""
        }${Math.round((m.weightLast - m.weightFirst) * 10) / 10} kg)`
      : m.weightLast != null
        ? `${m.weightLast} kg (one weigh-in)`
        : "not logged";
  return [
    `- Days logged: ${m.daysLogged} of ${m.daysInWindow}`,
    `- Energy average: ${m.energyAvg ?? "not logged"} (${m.energyCount} days)`,
    `- Sleep consistency: ${
      m.sleepConsistencyPct != null
        ? `${m.sleepConsistencyPct}% of ${m.wakesLogged} logged wakes within 30 min of target`
        : "not logged"
    }`,
    `- System adherence: ${m.adherencePct != null ? `${m.adherencePct}%` : "not logged"}`,
    `- Protein average: ${m.proteinAvg != null ? `${m.proteinAvg} g` : "not logged"} (hit target ${m.proteinDaysHit} of ${m.proteinDaysLogged} logged days)`,
    `- Weight: ${weight}`,
  ].join("\n");
}

export function buildMonthlyReviewPrompt(args: {
  profile: ProfileLike | null;
  stats: MonthlyStatsLike;
}): string {
  const { profile, stats: s } = args;

  const p = profile;
  const profileBlock = p
    ? [
        `Name: ${p.name ?? "unknown"}`,
        `Constraints: ${fmtConstraints(p.constraints)}`,
      ].join("\n")
    : "Profile not set.";

  const systemLines = s.systems
    .map(
      (x) =>
        `- ${x.name}: ${x.done} done, ${x.floor} min, ${x.skip} skip${
          x.ranPct != null ? ` (ran ${x.ranPct}% of logged days)` : ""
        }`
    )
    .join("\n");

  const goalLines = s.goals.length
    ? s.goals
        .map(
          (g) =>
            `- ${g.title}: ${g.progress}%${
              g.delta == null
                ? " (baseline, no prior monthly review)"
                : g.delta === 0
                  ? " (no movement)"
                  : ` (${g.delta > 0 ? "+" : ""}${g.delta} pts since last monthly review)`
            }${g.linked ? " [from systems]" : " [manual]"}${
              g.staleDays != null && g.staleDays >= 14
                ? ` (STALE: no movement in ${g.staleDays} days)`
                : ""
            }`
        )
        .join("\n")
    : "- no active goals";

  return `
=====  DATA (computed by the app; treat as exact, do not recompute)  =====

USER PROFILE
${profileBlock}

MONTH UNDER REVIEW: ${s.start} to ${s.end}
${fmtMonthNumbers(s.month)}

${
  s.prev
    ? `LAST MONTH (${s.prevLabel}), for comparison
${fmtMonthNumbers(s.prev)}`
    : "LAST MONTH: no data logged, so no comparison is possible. Do not invent one."
}

SYSTEMS THIS MONTH
${systemLines || "- no active systems"}

GOALS
${goalLines}

=====  END DATA  =====

Now produce the MONTHLY REVIEW exactly as instructed above.
`.trim();
}

// ---------- Onboarding proposal ----------

export const ONBOARDING_TASK = `
=====  YOUR TASK NOW: PROPOSE A PERSONALIZED LIFE OS  =====
A new user finished the intake below. Propose their starting Big Five systems,
two or three seed goals, and a short profile brief. They will edit everything
before saving, so propose confidently.

HARD RULES
- You write TEXT ONLY: rules, floors, ceilings, anchors, goal titles, the
  brief. You never state calorie numbers, macro targets, or any computed
  quantity; the app computes those in code.
- Ground everything in their intake: their level (never prescribe beginner work
  to an advanced user or vice versa), their constraints and injuries, their
  schedule, their stated failure modes.
- Every system needs a floor that survives their worst day.
- Coach voice per their stated style. Tight sentences. No emojis, no em dashes.

OUTPUT: raw JSON only, no markdown fences, exactly this shape:
{
  "systems": [
    { "domain": "Sleep", "name": "...", "rule": "...", "floor": "...", "ceiling": "...", "anchor": "..." },
    { "domain": "Flexible Schedule", ... },
    { "domain": "Imagination", ... },
    { "domain": "Diet", ... },
    { "domain": "Exercise", ... }
  ],
  "goals": [
    { "title": "...", "why": "one word", "quarter": 1-4 (the current quarter), "link": "manual" | "sleep_wake" | "training_sessions" | "diet_protein" }
  ],
  "profileBrief": "markdown summary of who this user is, their constraints, schedule reality, failure modes, and coaching style, written for their coach to read before every session"
}
Exactly the five domains shown, in that order. 2 or 3 goals.
`.trim();

export function buildOnboardingPrompt(intakeSummary: string): string {
  return `
=====  INTAKE (the user's own answers)  =====

${intakeSummary}

=====  END INTAKE  =====

Now produce the JSON proposal exactly as instructed above.
`.trim();
}

// ---------- Ask the coach ----------

export const ASK_TASK = `
=====  YOUR TASK NOW: ANSWER A QUESTION  =====
The user is asking you a quick question. Answer it in your voice, grounded in the
knowledge base and the user's profile.

RULES
- Persona: hardcore, directive, strategic, tight. No filler, no emojis, no em
  dashes, no double dashes.
- Never invent the user's personal numbers (energy, streaks, calories, times). If
  a specific number would be needed and you were not given it, say you do not have
  it and point them to the relevant page.
- Keep it under about 150 words unless the question truly needs more.
`.trim();

