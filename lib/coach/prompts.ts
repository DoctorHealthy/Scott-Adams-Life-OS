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
You are running a daily review for this user. Use the DATA block below as the
single source of truth.

HARD RULES:
- Every number you state must come from the DATA block. Do NOT compute, estimate,
  or invent any number (energy, averages, counts, dates, calories, times). If a
  number is missing, say "not logged" rather than guessing.
- Stay in persona: hardcore, directive, strategic, tight. No filler, no preamble,
  no emojis, no em dashes, no double dashes.
- Respect the user's constraints exactly (see profile in the knowledge base).

OUTPUT EXACTLY THESE THREE PARTS, with these headers:

READ
A 30-second read of the day. 2 to 4 tight lines: energy direction, what held,
what slipped. Tie it back to energy.

CORRECTION
One single smallest correction for tomorrow. Not a list. One move.

TOMORROW MORNING
2 to 4 named time blocks for tomorrow morning, each with a one-line reason.
Keep it to the morning, since that is the part the user controls.

If, and only if, the user's own words (one-line or reflection) show negative
self-talk or avoidance, add a fourth short part:

REFRAME
old frame -> new frame, then one line on the cue to repeat it.

Keep the whole thing under about 180 words. Orders, not essays.
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
