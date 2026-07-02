// Weekly review stats. Everything here is computed in code from the entries:
// adherence per system, energy-to-habit correlations, the sleep-shift step,
// and goal movement. The coach reads this snapshot and narrates it; it never
// computes or invents any of these numbers.

import { addDays } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import {
  computeSleepStats,
  readSleepLog,
  stepNumber,
  targetBedtime,
  HOLD_DAYS,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import {
  goalProgress,
  type Goal,
  type ProgressInputs,
} from "@/lib/goals/goals";

export type WeekEntry = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: unknown;
  module_logs: { sleep?: unknown; exercise?: unknown; mind?: unknown } | null;
};

export type SystemWeek = {
  id: string;
  name: string;
  domain: string | null;
  done: number;
  floor: number;
  skip: number;
  notLogged: number;
  label: "autopilot" | "willpower" | "attention";
};

export type Correlation = {
  name: string;
  energyOn: number; // avg energy on days the system was done
  energyOff: number; // avg energy on days it was not done
  gap: number; // energyOn - energyOff, rounded to 1 decimal
  daysOn: number;
  daysOff: number;
};

export type GoalWeek = {
  id: string;
  title: string;
  progress: number;
  delta: number | null; // vs the prior stored review, null if no baseline
  linked: boolean;
  staleDays?: number | null; // merged in by the route from review history
};

export type WeeklyStats = {
  start: string;
  end: string;
  daysLogged: number;
  energy: {
    avg: number | null;
    min: number | null;
    max: number | null;
    direction: "rising" | "falling" | "flat" | "unknown";
    count: number;
  };
  systems: SystemWeek[];
  correlations: Correlation[];
  candidate: { id: string; name: string } | null; // one system to reconsider
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
  goals: GoalWeek[];
};

export type GoalSnapshot = { id: string; progress: number };

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Energy-to-habit correlations over a window ending at `end`. For each system,
// average energy on days it was done vs days it was not. Only report where both
// buckets have >= 2 energy-logged days and the gap is >= 0.8, so noise never
// gets dressed up as a pattern. Shared by the weekly review and the daily
// review's pattern block.
export function computeEnergyCorrelations(args: {
  end: string;
  windowDays: number;
  systems: { id: string; name: string }[];
  entries: {
    date: string;
    energy_1_10: number | null;
    system_statuses: Record<string, SystemStatus>;
  }[];
}): Correlation[] {
  const { end, windowDays, systems, entries } = args;
  const start = addDays(end, -(windowDays - 1));
  const inWindow = entries.filter((e) => e.date >= start && e.date <= end);

  const out: Correlation[] = [];
  for (const s of systems) {
    const on: number[] = [];
    const off: number[] = [];
    for (const e of inWindow) {
      if (e.energy_1_10 == null) continue;
      const st = e.system_statuses?.[s.id];
      if (st === "done") on.push(e.energy_1_10);
      else off.push(e.energy_1_10);
    }
    if (on.length >= 2 && off.length >= 2) {
      const eOn = avg(on) as number;
      const eOff = avg(off) as number;
      const gap = round1(eOn - eOff);
      if (Math.abs(gap) >= 0.8) {
        out.push({
          name: s.name,
          energyOn: round1(eOn),
          energyOff: round1(eOff),
          gap,
          daysOn: on.length,
          daysOff: off.length,
        });
      }
    }
  }
  out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  return out;
}

export function computeWeeklyStats(args: {
  end: string;
  systems: System[];
  entries: WeekEntry[];
  sleepConfig: SleepConfig;
  goals: Goal[];
  progressInputs: ProgressInputs;
  priorGoalSnapshot: GoalSnapshot[] | null;
}): WeeklyStats {
  const { end, systems, entries, sleepConfig, goals, progressInputs, priorGoalSnapshot } =
    args;
  const start = addDays(end, -6);

  // The 7 calendar days in the window, and the entry for each (may be missing).
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const windowEntries = days
    .map((d) => byDate.get(d))
    .filter((e): e is WeekEntry => !!e);

  // ---- energy ----
  const energyByDay = days.map((d) => byDate.get(d)?.energy_1_10 ?? null);
  const energyVals = energyByDay.filter((n): n is number => n != null);
  const chrono = energyVals; // days[] is ascending, so this is chronological
  let direction: WeeklyStats["energy"]["direction"] = "unknown";
  if (chrono.length >= 4) {
    const half = Math.floor(chrono.length / 2);
    const earlier = avg(chrono.slice(0, half)) as number;
    const later = avg(chrono.slice(chrono.length - half)) as number;
    if (later >= earlier + 0.6) direction = "rising";
    else if (later <= earlier - 0.6) direction = "falling";
    else direction = "flat";
  } else if (chrono.length > 0) {
    direction = "flat";
  }

  // ---- per-system adherence ----
  const systemWeeks: SystemWeek[] = systems.map((s) => {
    let done = 0,
      floor = 0,
      skip = 0,
      notLogged = 0;
    for (const d of days) {
      const st = byDate.get(d)?.system_statuses?.[s.id];
      if (st === "done") done++;
      else if (st === "floor") floor++;
      else if (st === "skip") skip++;
      else notLogged++;
    }
    const ran = done + floor;
    let label: SystemWeek["label"];
    if (skip >= 3 || ran <= 2) label = "attention";
    else if (done >= 5 && skip === 0) label = "autopilot";
    else label = "willpower";
    return { id: s.id, name: s.name, domain: s.domain, done, floor, skip, notLogged, label };
  });

  // ---- energy-to-habit correlations (shared computation) ----
  const correlations = computeEnergyCorrelations({
    end,
    windowDays: 7,
    systems,
    entries: windowEntries,
  });

  // ---- one system to reconsider: most skips, then lowest done ----
  let candidate: WeeklyStats["candidate"] = null;
  const ranked = [...systemWeeks]
    .filter((s) => s.skip > 0 || s.label === "attention")
    .sort((a, b) => b.skip - a.skip || a.done - b.done);
  if (ranked.length > 0) candidate = { id: ranked[0].id, name: ranked[0].name };

  // ---- sleep-shift step ----
  const sleepStats = computeSleepStats(
    sleepConfig,
    windowEntries.map((e) => ({ date: e.date, wake: readSleepLog(e.module_logs?.sleep).wake }))
  );

  // ---- goal movement vs the prior stored review ----
  const priorMap = new Map((priorGoalSnapshot ?? []).map((g) => [g.id, g.progress]));
  const goalWeeks: GoalWeek[] = goals.map((g) => {
    const progress = goalProgress(g, progressInputs);
    const before = priorMap.get(g.id);
    return {
      id: g.id,
      title: g.title,
      progress,
      delta: before == null ? null : progress - before,
      linked: g.link !== "manual",
    };
  });

  return {
    start,
    end,
    daysLogged: windowEntries.length,
    energy: {
      avg: energyVals.length ? round1(avg(energyVals) as number) : null,
      min: energyVals.length ? Math.min(...energyVals) : null,
      max: energyVals.length ? Math.max(...energyVals) : null,
      direction,
      count: energyVals.length,
    },
    systems: systemWeeks,
    correlations,
    candidate,
    sleep: {
      stepNumber: stepNumber(sleepConfig),
      currentWake: sleepConfig.currentWake,
      targetBed: targetBedtime(sleepConfig),
      holdStreak: sleepStats.holdStreak,
      holdDays: HOLD_DAYS,
      eligible: sleepStats.eligible,
      nextWake: sleepStats.nextWake,
      atGoal: sleepStats.atGoal,
      latestWake: sleepStats.latestWake,
      driftMin: sleepStats.driftMin,
    },
    goals: goalWeeks,
  };
}

export function goalSnapshotFrom(stats: WeeklyStats): GoalSnapshot[] {
  return stats.goals.map((g) => ({ id: g.id, progress: g.progress }));
}
