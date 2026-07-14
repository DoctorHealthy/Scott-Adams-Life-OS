// The Cookie Jar: the user's real record wins, computed from all history.
// The coach throws one back when the user is weak or a commitment is at
// risk. Only target-independent records live here, so every number is true
// regardless of how targets moved over time.

import { addDays } from "@/lib/constants";
import { readSleepLog } from "@/lib/sleep/sleep";
import { readExerciseLog, floorMet, type Routine } from "@/lib/exercise/exercise";

export type RecordEntryLike = {
  date: string;
  energy_1_10: number | null;
  module_logs: { sleep?: unknown; exercise?: unknown } | null;
};

export type Records = {
  totalDaysLogged: number;
  longestLogStreak: number; // consecutive logged days
  bestSessionsIn7: number; // most real sessions in any 7-day window
  longestMinStreak: number; // consecutive days the exercise Min was held
  earliestWake: string | null; // earliest logged wake ever
  bestEnergyIn7: number | null; // best 7-day average energy, 1 decimal
};

export function computeRecords(
  entries: RecordEntryLike[],
  routines: Routine[]
): Records {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalDaysLogged = sorted.length;

  // Longest consecutive-day logging streak.
  let longestLogStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const e of sorted) {
    run = prev != null && e.date === addDays(prev, 1) ? run + 1 : 1;
    longestLogStreak = Math.max(longestLogStreak, run);
    prev = e.date;
  }

  // Sessions per rolling 7 days, and the exercise Min streak.
  const sessions: { date: string; s: boolean; min: boolean }[] = sorted.map((e) => {
    const log = readExerciseLog(e.module_logs?.exercise);
    return { date: e.date, s: log.session, min: floorMet(routines, log) };
  });
  let bestSessionsIn7 = 0;
  for (let i = 0; i < sessions.length; i++) {
    const from = addDays(sessions[i].date, -6);
    let n = 0;
    for (let j = 0; j <= i; j++) {
      if (sessions[j].date >= from && sessions[j].s) n++;
    }
    bestSessionsIn7 = Math.max(bestSessionsIn7, n);
  }
  let longestMinStreak = 0;
  run = 0;
  prev = null;
  for (const x of sessions) {
    if (x.min) {
      run = prev != null && x.date === addDays(prev, 1) ? run + 1 : 1;
      longestMinStreak = Math.max(longestMinStreak, run);
      prev = x.date;
    } else {
      prev = null;
      run = 0;
    }
  }

  // Earliest wake ever logged.
  let earliestWake: string | null = null;
  for (const e of sorted) {
    const wake = readSleepLog(e.module_logs?.sleep).wake;
    if (wake && (earliestWake == null || wake < earliestWake)) earliestWake = wake;
  }

  // Best 7-day average energy.
  let bestEnergyIn7: number | null = null;
  const energetic = sorted.filter((e) => e.energy_1_10 != null);
  for (let i = 0; i < energetic.length; i++) {
    const from = addDays(energetic[i].date, -6);
    const window = energetic.filter(
      (e) => e.date >= from && e.date <= energetic[i].date
    );
    if (window.length >= 3) {
      const avg =
        window.reduce((a, e) => a + (e.energy_1_10 as number), 0) / window.length;
      const r = Math.round(avg * 10) / 10;
      if (bestEnergyIn7 == null || r > bestEnergyIn7) bestEnergyIn7 = r;
    }
  }

  return {
    totalDaysLogged,
    longestLogStreak,
    bestSessionsIn7,
    longestMinStreak,
    earliestWake,
    bestEnergyIn7,
  };
}

export function recordsBlock(r: Records): string {
  return [
    `- Days logged, all time: ${r.totalDaysLogged}`,
    `- Longest logging streak: ${r.longestLogStreak} days`,
    `- Most real sessions in any 7 days: ${r.bestSessionsIn7}`,
    `- Longest exercise-Min streak: ${r.longestMinStreak} days`,
    `- Earliest wake ever logged: ${r.earliestWake ?? "none yet"}`,
    `- Best 7-day energy average: ${r.bestEnergyIn7 ?? "not enough data"}`,
  ].join("\n");
}
