// Miss detection for the daily review, all in code. The code decides WHAT was
// missed and lists the surrounding facts; the coach names the likely WHY and
// gives the concrete reversal. It never invents a miss or a number.

import type { System, SystemStatus } from "@/lib/types";

export type Miss = {
  what: string; // the miss, stated as a fact
  context: string[]; // surrounding facts, also computed in code
};

export function computeDailyMisses(args: {
  systems: System[];
  statuses: Record<string, SystemStatus>;
  energyToday: number | null;
  energyYesterday: number | null;
  sleep: {
    targetWake: string;
    latestWake: string | null;
    driftMin: number | null;
    targetBed: string;
    bedLogged: string | null; // the bed time on today's log (the night before this wake)
    bedDriftMin: number | null; // minutes past target bed, null if not logged
    morningLight: boolean;
    windDown: boolean;
  };
  exercise: {
    sessionDue: string;
    sessionDone: boolean;
    sessionsLast7: number;
    sessionsTarget: number;
  };
  diet: {
    kcalLogged: number;
    kcalTarget: number | null;
    proteinLogged: number;
    proteinTarget: number | null;
  };
  germanDay: boolean;
}): Miss[] {
  const { systems, statuses, energyToday, energyYesterday, sleep, exercise, diet, germanDay } =
    args;
  const misses: Miss[] = [];

  const energyFacts: string[] = [];
  if (energyToday != null) energyFacts.push(`energy today ${energyToday}`);
  if (energyYesterday != null) energyFacts.push(`energy yesterday ${energyYesterday}`);
  if (germanDay) energyFacts.push("German lesson day (Tue/Fri)");

  // 1. Wake drift past tolerance: the campaign anchor.
  if (sleep.driftMin != null && sleep.driftMin > 30 && sleep.latestWake) {
    const ctx: string[] = [];
    if (sleep.bedLogged) {
      ctx.push(
        `bed at ${sleep.bedLogged}${
          sleep.bedDriftMin != null && sleep.bedDriftMin > 0
            ? ` (${sleep.bedDriftMin} min past the ${sleep.targetBed} target)`
            : ` (target ${sleep.targetBed})`
        }`
      );
    } else {
      ctx.push(`bed time not logged (target ${sleep.targetBed})`);
    }
    ctx.push(`wind-down ${sleep.windDown ? "done" : "not done"}`);
    ctx.push(...energyFacts);
    misses.push({
      what: `Woke at ${sleep.latestWake}, ${sleep.driftMin} min past the ${sleep.targetWake} target`,
      context: ctx,
    });
  }

  // 2. Morning light missed (only meaningful if a wake was logged).
  if (sleep.latestWake && !sleep.morningLight) {
    misses.push({
      what: "Morning light not done",
      context: [`woke at ${sleep.latestWake}`, ...energyFacts],
    });
  }

  // 3. Training session not done, and the week is behind pace. A restful day
  // while at or above the weekly target is not a miss; never invent one.
  if (!exercise.sessionDone && exercise.sessionsLast7 < exercise.sessionsTarget) {
    const ctx: string[] = [
      `sessions this week ${exercise.sessionsLast7} of ${exercise.sessionsTarget}`,
    ];
    if (sleep.bedLogged) ctx.push(`bed last night ${sleep.bedLogged}`);
    ctx.push(...energyFacts);
    misses.push({
      what: `Training session not done (suggested: ${exercise.sessionDue})`,
      context: ctx,
    });
  }

  // 4. Protein under (only when the day has diet logs at all).
  if (
    diet.proteinTarget != null &&
    (diet.kcalLogged > 0 || diet.proteinLogged > 0) &&
    diet.proteinLogged < diet.proteinTarget * 0.85
  ) {
    misses.push({
      what: `Protein at ${diet.proteinLogged} g of the ${diet.proteinTarget} g target`,
      context: [
        `calories at ${diet.kcalLogged}${diet.kcalTarget != null ? ` of ${diet.kcalTarget}` : ""}`,
        ...energyFacts,
      ],
    });
  }

  // 5. Calories far under (chronic under-eating costs him weight).
  if (
    diet.kcalTarget != null &&
    diet.kcalLogged > 0 &&
    diet.kcalLogged < diet.kcalTarget * 0.8
  ) {
    misses.push({
      what: `Calories at ${diet.kcalLogged} of the ${diet.kcalTarget} target (${
        diet.kcalTarget - diet.kcalLogged
      } under)`,
      context: energyFacts,
    });
  }

  // 6. Systems the user explicitly marked skip (Exercise skips are already
  // covered by the session miss above, so exclude that domain).
  for (const s of systems) {
    if (statuses[s.id] === "skip" && s.domain !== "Exercise") {
      misses.push({
        what: `${s.name} marked skip`,
        context: energyFacts,
      });
    }
  }

  return misses;
}
