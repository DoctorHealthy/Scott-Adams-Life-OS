// Partner progress window (spec 9 + 17): both people's week at a glance,
// computed in code from sanitized progress rows. No journal text ever
// reaches this module, and numbers we cannot compute are marked not shared
// rather than guessed.

import { addDays } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import {
  goalProgress,
  type Goal,
  type ProgressInputs,
} from "@/lib/goals/goals";
import type { SleepConfig } from "@/lib/sleep/sleep";

// A sanitized day of progress, from partner_progress() or built from own entries.
export type ProgressDay = {
  day: string;
  energy: number | null;
  statuses: Record<string, SystemStatus>;
  exercise: { warmup: boolean; session: boolean; ankle: boolean };
  sleep: { wake: string | null; windDown: boolean; morningLight: boolean };
};

export type WeekPerson = {
  name: string;
  days: string[]; // the 7 dates, ascending
  energy: (number | null)[];
  energyAvg: number | null;
  systems: {
    id: string;
    name: string;
    statuses: (SystemStatus | null)[]; // per day
    ran: number; // done + floor this week
  }[];
  streak: number; // consecutive days (ending latest logged day) with >= 1 done/floor
  goals: { id: string; title: string; progress: number | null }[]; // null = not shared
};

export function buildWeekPerson(args: {
  name: string;
  end: string;
  days7?: ProgressDay[];
  systems: { id: string; name: string }[];
  goals: Goal[];
  sleepConfig: SleepConfig | null;
  sessionsTarget: number | null;
  proteinInputsAvailable: boolean; // true only for the viewer's own data
  progressInputs: ProgressInputs | null; // full inputs when available (own data)
}): WeekPerson {
  const {
    name,
    end,
    days7 = [],
    systems,
    goals,
    sleepConfig,
    sessionsTarget,
    proteinInputsAvailable,
    progressInputs,
  } = args;

  const start = addDays(end, -6);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  const byDay = new Map(days7.map((d) => [d.day, d]));

  const energy = days.map((d) => byDay.get(d)?.energy ?? null);
  const logged = energy.filter((e): e is number => e != null);
  const energyAvg = logged.length
    ? Math.round((logged.reduce((a, b) => a + b, 0) / logged.length) * 10) / 10
    : null;

  const systemRows = systems.map((s) => {
    const statuses = days.map((d) => byDay.get(d)?.statuses?.[s.id] ?? null);
    const ran = statuses.filter((st) => st === "done" || st === "floor").length;
    return { id: s.id, name: s.name, statuses, ran };
  });

  // Streak: consecutive days, walking back from the latest day that has any
  // log, where at least one system was done or floored.
  let streak = 0;
  const daysDesc = [...days].reverse();
  let started = false;
  for (const d of daysDesc) {
    const row = byDay.get(d);
    const any = row && Object.values(row.statuses).some((st) => st === "done" || st === "floor");
    if (!row && !started) continue; // today may be unlogged; skip until first log
    started = true;
    if (any) streak++;
    else break;
  }

  // Goal progress: full inputs for own data; for the partner, compute what the
  // shared data supports and mark the rest not shared (never invent).
  const goalRows = goals.map((g) => {
    if (progressInputs) {
      return { id: g.id, title: g.title, progress: goalProgress(g, progressInputs) };
    }
    if (g.link === "manual") {
      const inputs: ProgressInputs = {
        sleepConfig: sleepConfig ?? {
          startWake: "10:30",
          currentWake: "10:30",
          goalWake: "08:15",
          stepMinutes: 30,
          sleepHours: 8,
          stepStartedOn: null,
        },
        sessionsLast7: 0,
        sessionsTarget: 0,
        proteinDaysHit: 0,
        proteinDaysLogged: 0,
      };
      return { id: g.id, title: g.title, progress: goalProgress(g, inputs) };
    }
    if (g.link === "sleep_wake" && sleepConfig) {
      const inputs: ProgressInputs = {
        sleepConfig,
        sessionsLast7: 0,
        sessionsTarget: 0,
        proteinDaysHit: 0,
        proteinDaysLogged: 0,
      };
      return { id: g.id, title: g.title, progress: goalProgress(g, inputs) };
    }
    if (g.link === "training_sessions" && sessionsTarget != null) {
      const sessions = days.filter((d) => byDay.get(d)?.exercise.session).length;
      const inputs: ProgressInputs = {
        sleepConfig: sleepConfig ?? {
          startWake: "10:30",
          currentWake: "10:30",
          goalWake: "08:15",
          stepMinutes: 30,
          sleepHours: 8,
          stepStartedOn: null,
        },
        sessionsLast7: sessions,
        sessionsTarget,
        proteinDaysHit: 0,
        proteinDaysLogged: 0,
      };
      return { id: g.id, title: g.title, progress: goalProgress(g, inputs) };
    }
    if (g.link === "diet_protein" && !proteinInputsAvailable) {
      // Meal numbers are not shared; do not fabricate a percentage.
      return { id: g.id, title: g.title, progress: null };
    }
    return { id: g.id, title: g.title, progress: null };
  });

  return {
    name,
    days,
    energy,
    energyAvg,
    systems: systemRows,
    streak,
    goals: goalRows,
  };
}

// Read the owner's hidden-system list from their coaching_prefs.
export function readHiddenSystems(
  coachingPrefs: Record<string, unknown> | null | undefined
): string[] {
  const s = (coachingPrefs?.sharing ?? {}) as { hiddenSystems?: unknown };
  return Array.isArray(s.hiddenSystems)
    ? s.hiddenSystems.filter((x): x is string => typeof x === "string")
    : [];
}

// Read the owner's hidden-goal list from their coaching_prefs.
export function readHiddenGoals(
  coachingPrefs: Record<string, unknown> | null | undefined
): string[] {
  const s = (coachingPrefs?.sharing ?? {}) as { hiddenGoals?: unknown };
  return Array.isArray(s.hiddenGoals)
    ? s.hiddenGoals.filter((x): x is string => typeof x === "string")
    : [];
}

// Turn own full entries into sanitized ProgressDay rows so both columns of the
// partner view run through the identical code path.
export function progressDaysFromEntries(
  entries: {
    date: string;
    energy_1_10: number | null;
    system_statuses: Record<string, SystemStatus>;
    module_logs: { sleep?: unknown; exercise?: unknown } | null;
  }[]
): ProgressDay[] {
  return entries.map((e) => {
    const ex = (e.module_logs?.exercise ?? {}) as {
      warmup?: unknown;
      session?: unknown;
      ankle?: unknown;
    };
    const sl = (e.module_logs?.sleep ?? {}) as {
      wake?: unknown;
      windDown?: unknown;
      morningLight?: unknown;
    };
    return {
      day: e.date,
      energy: e.energy_1_10,
      statuses: e.system_statuses ?? {},
      exercise: {
        warmup: !!ex.warmup,
        session: !!ex.session,
        ankle: !!ex.ankle,
      },
      sleep: {
        wake: typeof sl.wake === "string" ? sl.wake : null,
        windDown: !!sl.windDown,
        morningLight: !!sl.morningLight,
      },
    };
  });
}
