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

export type ExerciseConfig = {
  sessionsTarget: number; // 3 to 4 real sessions a week
  sessionTypes: SessionType[];
};

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  sessionsTarget: 4,
  sessionTypes: DEFAULT_SESSION_TYPES,
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
