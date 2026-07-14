// Exercise engine. Session counts, routine completion, and the Min streak are
// computed here in code. The coach reads them and holds the line; it never
// counts.
//
// Routines are user-defined blocks (add / rename / remove): each has editable
// items, a `track` flag (log it daily on Today) and a `min` flag (counts
// toward the daily Min). Reference-only blocks (track=false) live in the
// playbook without daily logging.

import { addDays } from "@/lib/constants";

export type SessionType = { id: string; label: string };

export type Routine = {
  id: string;
  name: string;
  items: string[];
  min: boolean; // counts toward the daily Min
  track: boolean; // shown as a daily toggle on Today
};

export const DEFAULT_SESSION_TYPES: SessionType[] = [
  { id: "strength-endurance", label: "Strength-endurance" },
  { id: "power", label: "Power" },
  { id: "climbing", label: "Climbing / bouldering" },
  { id: "sport", label: "Sport (tennis, basketball)" },
  { id: "hike", label: "Hike" },
];

export const DEFAULT_WARMUP: string[] = [
  "Light cardio, 2 to 3 min (jog in place, jumping jacks, skipping).",
  "Joint circles: ankles, knees, hips, shoulders, wrists.",
  "Dynamic stretches: leg swings, walking lunges with torso rotation, arm swings.",
  "Scapular activation: band pull-aparts or scap push-ups.",
  "Hip openers: 90/90 transitions, a deep squat hold.",
  "One easy set of the first exercise to groove the movement.",
];

export const DEFAULT_PREHAB: string[] = [
  "Calf raises: 3 x 15 to 20.",
  "Single-leg balance: 3 x 30 to 45 s per side.",
  "Hip mobility: 90/90 transitions, 2 x 10 per side.",
  "Ankle mobility: knee-to-wall, 3 x 10 per side.",
  "Glute activation: banded bridges, 2 x 15.",
];

export const DEFAULT_ROUTINES: Routine[] = [
  { id: "warmup", name: "Warm-up", items: DEFAULT_WARMUP, min: true, track: true },
  { id: "ankle", name: "Prehab / mobility", items: DEFAULT_PREHAB, min: true, track: true },
];

// The pre-routines structure card content, kept verbatim as a reference block
// for accounts that predate editable routines.
const LEGACY_STRUCTURE_ITEMS: string[] = [
  "Strength-endurance (2 a week): higher-rep, density circuits, short rest. Push (push-up variations, pike, dips), pull (pull-ups, rows, hangs for grip), legs (lunges, Bulgarian split squats, pistols, jump squats), core (hollow holds, hanging leg raises, planks). Pick 4 to 5 moves, 3 to 4 rounds, EMOM or AMRAP.",
  "Power (1 a week): explosive, low reps, full recovery, max intent. Box or broad jumps, plyo push-ups, kettlebell swings, med-ball throws. Outdoors: hill sprints, short and hard with full rest. Quality over fatigue.",
  "Climbing / sport day: bouldering counts as a full session. Warm the fingers first, easy problems before hard. Tennis or basketball counts too.",
];

export type ExerciseConfig = {
  sessionsTarget: number; // 1 to 7 real sessions a week
  sessionTypes: SessionType[];
  routines: Routine[];
};

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  sessionsTarget: 4,
  sessionTypes: DEFAULT_SESSION_TYPES,
  routines: DEFAULT_ROUTINES,
};

function readRoutines(raw: unknown): Routine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Routine[] = [];
  for (const r of raw as Partial<Routine>[]) {
    if (!r || typeof r.id !== "string" || typeof r.name !== "string") continue;
    out.push({
      id: r.id,
      name: r.name,
      items: Array.isArray(r.items)
        ? (r.items as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      min: !!r.min,
      track: r.track !== false,
    });
  }
  return out.length > 0 ? out : null;
}

export function readExerciseConfig(
  prefs: Record<string, unknown> | null | undefined
): ExerciseConfig {
  const e = (prefs?.exercise ?? {}) as {
    sessionsTarget?: unknown;
    sessionTypes?: unknown;
    routines?: unknown;
    warmup?: unknown; // legacy keys, pre-routines
    ankle?: unknown;
  };

  // Prefer the saved routines; otherwise build them from the legacy
  // warmup/ankle lists so existing accounts keep their content (the fixed
  // structure card becomes an editable reference block).
  const routines =
    readRoutines(e.routines) ??
    (() => {
      const warmup =
        Array.isArray(e.warmup) && (e.warmup as string[]).length > 0
          ? (e.warmup as string[])
          : DEFAULT_WARMUP;
      const ankle =
        Array.isArray(e.ankle) && (e.ankle as string[]).length > 0
          ? (e.ankle as string[])
          : DEFAULT_PREHAB;
      return [
        { id: "warmup", name: "Warm-up", items: warmup, min: true, track: true },
        { id: "ankle", name: "Prehab / mobility", items: ankle, min: true, track: true },
        {
          id: "structure",
          name: "Weekly session structure",
          items: LEGACY_STRUCTURE_ITEMS,
          min: false,
          track: false,
        },
      ];
    })();

  return {
    sessionsTarget: typeof e.sessionsTarget === "number" ? e.sessionsTarget : 4,
    sessionTypes:
      Array.isArray(e.sessionTypes) && (e.sessionTypes as SessionType[]).length > 0
        ? (e.sessionTypes as SessionType[])
        : DEFAULT_SESSION_TYPES,
    routines,
  };
}

// ---------- the daily log ----------

export type ExerciseLog = {
  session: boolean;
  sessionType: string | null;
  routines: Record<string, boolean>; // routine id -> done today
};

export function emptyExerciseLog(): ExerciseLog {
  return { session: false, sessionType: null, routines: {} };
}

export function readExerciseLog(raw: unknown): ExerciseLog {
  if (raw && typeof raw === "object") {
    const o = raw as {
      session?: unknown;
      sessionType?: unknown;
      routines?: unknown;
      warmup?: unknown; // legacy booleans, pre-routines
      ankle?: unknown;
    };
    const routines: Record<string, boolean> = {};
    if (o.routines && typeof o.routines === "object") {
      for (const [k, v] of Object.entries(o.routines as Record<string, unknown>)) {
        routines[k] = !!v;
      }
    } else {
      // Legacy log shape maps onto the legacy routine ids.
      if (o.warmup != null) routines.warmup = !!o.warmup;
      if (o.ankle != null) routines.ankle = !!o.ankle;
    }
    return {
      session: !!o.session,
      sessionType: typeof o.sessionType === "string" ? o.sessionType : null,
      routines,
    };
  }
  return emptyExerciseLog();
}

// Min = every tracked routine flagged `min` done today. With no min routines
// configured there is no Min to hold, so the streak stays at 0.
export function floorMet(routines: Routine[], l: ExerciseLog): boolean {
  const required = routines.filter((r) => r.track && r.min);
  if (required.length === 0) return false;
  return required.every((r) => !!l.routines[r.id]);
}

export function sessionTypeLabel(
  cfg: ExerciseConfig,
  id: string | null
): string {
  if (!id) return "none";
  return cfg.sessionTypes.find((t) => t.id === id)?.label ?? id;
}

export type ExerciseStats = {
  sessionsLast7: number;
  sessionsTarget: number;
  floorStreak: number; // consecutive days the Min was held, ending today
};

export function computeExerciseStats(
  cfg: ExerciseConfig,
  recent: { date: string; log: ExerciseLog }[],
  today: string
): ExerciseStats {
  const map = new Map(recent.map((r) => [r.date, r.log]));

  // Sessions in the last 7 calendar days, inclusive of today.
  const from = addDays(today, -6);
  let sessionsLast7 = 0;
  for (const r of recent) {
    if (r.date >= from && r.date <= today && r.log.session) sessionsLast7++;
  }

  // Min streak: walk back day by day from today. Today not logged yet does
  // not break it; a past missing or Min-missed day does.
  let floorStreak = 0;
  let d = today;
  let first = true;
  while (true) {
    const log = map.get(d);
    if (!log) {
      if (first && d === today) {
        d = addDays(d, -1);
        first = false;
        continue;
      }
      break;
    }
    if (floorMet(cfg.routines, log)) {
      floorStreak++;
      d = addDays(d, -1);
      first = false;
    } else {
      break;
    }
  }

  return { sessionsLast7, sessionsTarget: cfg.sessionsTarget, floorStreak };
}
