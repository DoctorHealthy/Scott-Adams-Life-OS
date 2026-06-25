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
- Persona: hardcore, directive, strategic, tight. No filler, no preamble, no
  emojis, no em dashes, no double dashes. Reads numbers, never computes them.
- Respect the user's constraints (see profile).

FORMAT, exactly this, plain text only. No markdown symbols, no all-caps headers.
Use the small lowercase-style labels shown.

Verdict: one punchy line naming the single most important thing about today.

Then a blank line, then the read with NO label: 2 to 4 tight sentences in your
voice, connecting the systems and grounded in the numbers (energy direction, what
held and what slipped across sleep, diet, exercise, mind, schedule).

Move: the single highest-leverage correction for tomorrow, one line.

Tomorrow:
Then 2 to 4 morning time blocks, one per line, formatted "07:30  block, short
reason", grounded in today's data (for example anchor the first block to morning
light if it was missed).

Reframe: include this line ONLY if the user's one-line or reflection shows negative
self-talk. Format "old frame -> new frame. Repeat it when <cue>."

Keep the whole thing under 250 words. Orders, not essays.
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
  mealCount: number;
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

export function buildDailyReviewPrompt(args: {
  profile: ProfileLike | null;
  systems: System[];
  entry: Entry;
  recent: RecentEntry[];
  date: string;
  diet: DietNumbers;
  sleep: SleepNumbers;
  exercise: ExerciseNumbers;
}): string {
  const { profile, systems, entry, recent, date, diet, sleep, exercise } = args;

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
- Tally: ${counts.done} done, ${counts.floor} floor, ${counts.skip} skip, ${counts.not_logged} not logged

DIET TODAY (computed by the app from the meals the user logged)
${
  diet.ok
    ? `- Calories logged: ${diet.loggedKcal} of ${diet.targetKcal ?? "not set"} target (${
        diet.targetKcal != null ? diet.targetKcal - diet.loggedKcal : "?"
      } kcal under)
- Protein logged: ${diet.loggedProtein} g of ${diet.targetProtein ?? "not set"} g target (${
        diet.targetProtein != null ? diet.targetProtein - diet.loggedProtein : "?"
      } g under)
- Meals and snacks logged: ${diet.mealCount}
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

THE USER'S OWN WORDS TODAY
- One line: ${entry.one_line ?? "not logged"}
- Reflection: ${entry.reflection ?? "not logged"}
- Tomorrow's next action (their plan): ${entry.tomorrow_next_action ?? "not logged"}

=====  END DATA  =====

Now produce the DAILY REVIEW exactly as instructed above.
`.trim();
}
