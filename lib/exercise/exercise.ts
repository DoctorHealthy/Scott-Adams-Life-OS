// Exercise engine. Session counts and the floor streak are computed here in
// code. The coach reads them and holds the line; it never counts.

import { addDays } from "@/lib/constants";

export type SessionType = { id: string; label: string };

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

export type ExerciseConfig = {
  sessionsTarget: number; // 1 to 7 real sessions a week
  sessionTypes: SessionType[];
  warmup: string[];
  ankle: string[];
};

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  sessionsTarget: 4,
  sessionTypes: DEFAULT_SESSION_TYPES,
  warmup: DEFAULT_WARMUP,
  ankle: DEFAULT_PREHAB,
};

export type ExerciseLog = {
  warmup: boolean;
  session: boolean;
  sessionType: string | null;
  ankle: boolean;
};

export type ExerciseStats = {
  sessionsLast7: number;
  sessionsTarget: number;
  floorStreak: number; // consecutive days the floor was held, ending today
};

export function readExerciseConfig(
  prefs: Record<string, unknown> | null | undefined
): ExerciseConfig {
  const e = (prefs?.exercise ?? {}) as Partial<ExerciseConfig>;
  return {
    sessionsTarget:
      typeof e.sessionsTarget === "number" ? e.sessionsTarget : 4,
    sessionTypes:
      Array.isArray(e.sessionTypes) && e.sessionTypes.length > 0
        ? (e.sessionTypes as SessionType[])
        : DEFAULT_SESSION_TYPES,
    warmup:
      Array.isArray(e.warmup) && e.warmup.length > 0
        ? (e.warmup as string[])
        : DEFAULT_WARMUP,
    ankle:
      Array.isArray(e.ankle) && e.ankle.length > 0
        ? (e.ankle as string[])
        : DEFAULT_PREHAB,
  };
}

export function emptyExerciseLog(): ExerciseLog {
  return { warmup: false, session: false, sessionType: null, ankle: false };
}

export function readExerciseLog(raw: unknown): ExerciseLog {
  if (raw && typeof raw === "object") {
    const o = raw as Partial<ExerciseLog>;
    return {
      warmup: !!o.warmup,
      session: !!o.session,
      sessionType: typeof o.sessionType === "string" ? o.sessionType : null,
      ankle: !!o.ankle,
    };
  }
  return emptyExerciseLog();
}

// Floor = the bad-day minimum: warm-up plus ankle work (plus a walk).
export function floorMet(l: ExerciseLog): boolean {
  return l.warmup && l.ankle;
}

export function sessionTypeLabel(
  cfg: ExerciseConfig,
  id: string | null
): string {
  if (!id) return "none";
  return cfg.sessionTypes.find((t) => t.id === id)?.label ?? id;
}

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

  // Floor streak: walk back day by day from today. Today not logged yet does
  // not break it; a past missing or floor-missed day does.
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
    if (floorMet(log)) {
      floorStreak++;
      d = addDays(d, -1);
      first = false;
    } else {
      break;
    }
  }

  return { sessionsLast7, sessionsTarget: cfg.sessionsTarget, floorStreak };
}
