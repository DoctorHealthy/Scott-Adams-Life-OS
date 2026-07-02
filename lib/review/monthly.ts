// Monthly review stats. The zoom-out: the month's trends (energy, sleep
// consistency, adherence, weight, protein), goal progress, and what changed
// versus last month. Every number computed here in code; the coach narrates.

import type { System, SystemStatus } from "@/lib/types";
import { readDietLog } from "@/lib/diet/log";
import {
  hhmmToMin,
  clockDiffMin,
  readSleepLog,
  WAKE_TOLERANCE_MIN,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import { goalProgress, type Goal, type ProgressInputs } from "@/lib/goals/goals";
import type { WeekEntry } from "@/lib/review/weekly";

export type MonthEntry = WeekEntry;

export type MonthNumbers = {
  daysLogged: number;
  daysInWindow: number;
  energyAvg: number | null;
  energyCount: number;
  sleepConsistencyPct: number | null; // logged wakes within tolerance of target
  wakesLogged: number;
  adherencePct: number | null; // done+floor over active systems on logged days
  proteinAvg: number | null;
  proteinDaysHit: number;
  proteinDaysLogged: number;
  weightFirst: number | null;
  weightLast: number | null;
};

export type MonthlyGoal = {
  id: string;
  title: string;
  progress: number;
  delta: number | null; // vs prior stored monthly review
  linked: boolean;
};

export type MonthlyStats = {
  start: string; // first day of the month under review
  end: string; // the day the review ran (partial months are fine)
  month: MonthNumbers;
  prev: MonthNumbers | null; // the full previous calendar month, if any data
  prevLabel: string | null; // e.g. "2026-06"
  systems: {
    id: string;
    name: string;
    done: number;
    floor: number;
    skip: number;
    ranPct: number | null; // done+floor over days logged
  }[];
  goals: MonthlyGoal[];
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function monthStartOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function prevMonthRange(dateStr: string): { start: string; end: string } {
  const [y, m] = dateStr.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const lastDay = new Date(py, pm, 0).getDate(); // day 0 of next month
  const mm = String(pm).padStart(2, "0");
  return { start: `${py}-${mm}-01`, end: `${py}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const a = new Date(sy, sm - 1, sd);
  const b = new Date(ey, em - 1, ed);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function computeMonthNumbers(
  entries: MonthEntry[],
  start: string,
  end: string,
  systems: System[],
  sleepConfig: SleepConfig,
  proteinTarget: number | null
): MonthNumbers {
  const inWindow = entries
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const energies = inWindow
    .map((e) => e.energy_1_10)
    .filter((n): n is number => n != null);

  const targetWake = hhmmToMin(sleepConfig.currentWake);
  let wakesLogged = 0;
  let wakesWithin = 0;
  for (const e of inWindow) {
    const wake = readSleepLog(e.module_logs?.sleep).wake;
    if (wake) {
      wakesLogged++;
      if (clockDiffMin(hhmmToMin(wake), targetWake) <= WAKE_TOLERANCE_MIN)
        wakesWithin++;
    }
  }

  const activeCount = systems.length;
  let ranSum = 0;
  let ranDays = 0;
  for (const e of inWindow) {
    const statuses = e.system_statuses ?? {};
    if (Object.keys(statuses).length === 0 || activeCount === 0) continue;
    let ran = 0;
    for (const s of systems) {
      const st = statuses[s.id];
      if (st === "done" || st === "floor") ran++;
    }
    ranSum += ran / activeCount;
    ranDays++;
  }

  const proteinVals: number[] = [];
  let proteinDaysHit = 0;
  const weights: { date: string; kg: number }[] = [];
  for (const e of inWindow) {
    const d = readDietLog(e.meals);
    if (d.protein > 0) {
      proteinVals.push(d.protein);
      if (proteinTarget != null && d.protein >= proteinTarget * 0.9) proteinDaysHit++;
    }
    if (d.weightKg != null) weights.push({ date: e.date, kg: d.weightKg });
  }

  return {
    daysLogged: inWindow.length,
    daysInWindow: daysBetween(start, end),
    energyAvg: avg(energies),
    energyCount: energies.length,
    sleepConsistencyPct:
      wakesLogged > 0 ? Math.round((wakesWithin / wakesLogged) * 100) : null,
    wakesLogged,
    adherencePct: ranDays > 0 ? Math.round((ranSum / ranDays) * 100) : null,
    proteinAvg: avg(proteinVals),
    proteinDaysHit,
    proteinDaysLogged: proteinVals.length,
    weightFirst: weights[0]?.kg ?? null,
    weightLast: weights[weights.length - 1]?.kg ?? null,
  };
}

export function computeMonthlyStats(args: {
  end: string;
  entries: MonthEntry[]; // should cover this month plus the whole prior month
  systems: System[];
  sleepConfig: SleepConfig;
  proteinTarget: number | null;
  goals: Goal[];
  progressInputs: ProgressInputs;
  priorGoalSnapshot: { id: string; progress: number }[] | null;
}): MonthlyStats {
  const {
    end,
    entries,
    systems,
    sleepConfig,
    proteinTarget,
    goals,
    progressInputs,
    priorGoalSnapshot,
  } = args;

  const start = monthStartOf(end);
  const prevRange = prevMonthRange(end);

  const month = computeMonthNumbers(
    entries,
    start,
    end,
    systems,
    sleepConfig,
    proteinTarget
  );
  const prevNumbers = computeMonthNumbers(
    entries,
    prevRange.start,
    prevRange.end,
    systems,
    sleepConfig,
    proteinTarget
  );
  const prev = prevNumbers.daysLogged > 0 ? prevNumbers : null;

  // Per-system counts for the month under review.
  const inMonth = entries.filter((e) => e.date >= start && e.date <= end);
  const systemRows = systems.map((s) => {
    let done = 0,
      floor = 0,
      skip = 0,
      logged = 0;
    for (const e of inMonth) {
      const st = e.system_statuses?.[s.id];
      if (!st) continue;
      logged++;
      if (st === "done") done++;
      else if (st === "floor") floor++;
      else if (st === "skip") skip++;
    }
    return {
      id: s.id,
      name: s.name,
      done,
      floor,
      skip,
      ranPct: logged > 0 ? Math.round(((done + floor) / logged) * 100) : null,
    };
  });

  const priorMap = new Map((priorGoalSnapshot ?? []).map((g) => [g.id, g.progress]));
  const goalRows: MonthlyGoal[] = goals.map((g) => {
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
    month,
    prev,
    prevLabel: prev ? prevRange.start.slice(0, 7) : null,
    systems: systemRows,
    goals: goalRows,
  };
}
