// Code-computed signals that drive the daily briefing. The AI narrates these;
// it never computes or invents them. This is what makes the briefing change
// day to day instead of reciting static targets.

import { addDays } from "@/lib/constants";
import {
  computeSleepStats,
  readSleepLog,
  stepNumber,
  targetBedtime,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import {
  computeExerciseStats,
  readExerciseLog,
  type ExerciseConfig,
} from "@/lib/exercise/exercise";
import { sessionForDate } from "@/lib/today/plan";
import { readDietLog, logTotals } from "@/lib/diet/log";
import type { System } from "@/lib/types";

export type BriefingRecent = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, "done" | "floor" | "skip">;
  meals: unknown;
  module_logs: { sleep?: unknown; exercise?: unknown } | null;
};

export type BriefingSignals = {
  name: string;
  germanDay: boolean;
  yesterday: { logged: boolean; energy: number | null; slipped: string[] };
  energy7: { avg: number | null; direction: "rising" | "falling" | "flat" | "unknown"; count: number };
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
  diet: {
    proteinAvg: number | null;
    proteinTarget: number | null;
    proteinUnder: boolean;
  };
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeBriefingSignals(args: {
  date: string;
  name: string;
  systems: System[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  proteinTarget: number | null;
  recent: BriefingRecent[];
}): BriefingSignals {
  const { date, name, systems, sleepConfig, exerciseConfig, proteinTarget, recent } =
    args;

  const sorted = [...recent].sort((a, b) => (a.date < b.date ? 1 : -1));
  const nameById = new Map(systems.map((s) => [s.id, s.name]));

  // German day: Tue (2) or Fri (5).
  const [yy, mm, dd] = date.split("-").map(Number);
  const dow = new Date(yy, mm - 1, dd).getDay();
  const germanDay = dow === 2 || dow === 5;

  // Yesterday.
  const yDate = addDays(date, -1);
  const yEntry = sorted.find((r) => r.date === yDate) ?? null;
  const slipped: string[] = [];
  if (yEntry) {
    for (const [id, st] of Object.entries(yEntry.system_statuses ?? {})) {
      if (st === "skip" || st === "floor") {
        slipped.push(nameById.get(id) ?? "a system");
      }
    }
  }

  // 7-day energy trend.
  const energies = sorted
    .filter((r) => r.date <= date && r.energy_1_10 != null)
    .slice(0, 7)
    .map((r) => r.energy_1_10 as number);
  const avg7 = avg(energies);
  let direction: BriefingSignals["energy7"]["direction"] = "unknown";
  if (energies.length >= 3) {
    const recent3 = avg(energies.slice(0, 3)) as number;
    const older = avg(energies.slice(3)) as number | null;
    if (older == null) direction = "flat";
    else if (recent3 >= older + 0.6) direction = "rising";
    else if (recent3 <= older - 0.6) direction = "falling";
    else direction = "flat";
  }

  // Sleep.
  const sleepStats = computeSleepStats(
    sleepConfig,
    sorted.map((r) => ({
      date: r.date,
      wake: readSleepLog(r.module_logs?.sleep).wake,
    }))
  );

  // Exercise.
  const exStats = computeExerciseStats(
    exerciseConfig,
    sorted.map((r) => ({
      date: r.date,
      log: readExerciseLog(r.module_logs?.exercise),
    })),
    date
  );

  // Diet protein over the last 3 logged days that have meals.
  const proteinVals = sorted
    .filter((r) => r.date <= date)
    .map((r) => logTotals(readDietLog(r.meals).items).protein)
    .filter((p) => p > 0)
    .slice(0, 3);
  const proteinAvg = avg(proteinVals);
  const proteinUnder =
    proteinAvg != null && proteinTarget != null && proteinAvg < proteinTarget * 0.85;

  return {
    name,
    germanDay,
    yesterday: {
      logged: !!yEntry,
      energy: yEntry?.energy_1_10 ?? null,
      slipped,
    },
    energy7: { avg: avg7, direction, count: energies.length },
    sleep: {
      stepNumber: stepNumber(sleepConfig),
      currentWake: sleepConfig.currentWake,
      targetBed: targetBedtime(sleepConfig),
      lastWake: sleepStats.latestWake,
      driftMin: sleepStats.driftMin,
      holdStreak: sleepStats.holdStreak,
      eligible: sleepStats.eligible,
      atGoal: sleepStats.atGoal,
    },
    training: {
      sessionDue: sessionForDate(exerciseConfig, date),
      sessionsLast7: exStats.sessionsLast7,
      sessionsTarget: exStats.sessionsTarget,
      floorStreak: exStats.floorStreak,
      behind: exStats.sessionsLast7 < exStats.sessionsTarget,
    },
    diet: { proteinAvg, proteinTarget, proteinUnder },
  };
}
