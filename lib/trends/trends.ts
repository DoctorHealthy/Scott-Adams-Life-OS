// Trend series over time, all computed in code from the entries. The trends
// page charts these, and the coach's pattern-finding reads them. The AI never
// derives a series or a number itself.

import { addDays } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { readDietLog } from "@/lib/diet/log";
import {
  hhmmToMin,
  clockDiffMin,
  readSleepLog,
  WAKE_TOLERANCE_MIN,
  type SleepConfig,
} from "@/lib/sleep/sleep";

export type TrendEntry = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: unknown;
  module_logs: { sleep?: unknown; exercise?: unknown } | null;
};

export type Point = { date: string; value: number | null };

export type TrendSeries = {
  start: string;
  end: string;
  energy: Point[]; // 1-10
  wakeMin: Point[]; // actual wake in minutes after midnight
  wakeTargetMin: number; // current target wake for the reference line
  adherencePct: Point[]; // % of active systems marked done or floor that day
  protein: Point[]; // grams
  proteinTarget: number | null;
  weight: Point[]; // kg
  sleepConsistencyPct: number | null; // % of logged wakes within tolerance
};

export function buildTrendSeries(args: {
  end: string;
  days: number; // window length, e.g. 90
  entries: TrendEntry[];
  systems: System[];
  sleepConfig: SleepConfig;
  proteinTarget: number | null;
}): TrendSeries {
  const { end, days, entries, systems, sleepConfig, proteinTarget } = args;
  const start = addDays(end, -(days - 1));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const activeCount = systems.length;
  const targetWake = hhmmToMin(sleepConfig.currentWake);

  const energy: Point[] = [];
  const wakeMin: Point[] = [];
  const adherencePct: Point[] = [];
  const protein: Point[] = [];
  const weight: Point[] = [];
  let wakesLogged = 0;
  let wakesWithin = 0;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const e = byDate.get(date);

    energy.push({ date, value: e?.energy_1_10 ?? null });

    const wake = e ? readSleepLog(e.module_logs?.sleep).wake : null;
    const wakeVal = wake ? hhmmToMin(wake) : null;
    wakeMin.push({ date, value: wakeVal });
    if (wakeVal != null) {
      wakesLogged++;
      if (clockDiffMin(wakeVal, targetWake) <= WAKE_TOLERANCE_MIN) wakesWithin++;
    }

    if (e && activeCount > 0) {
      let ran = 0;
      for (const s of systems) {
        const st = e.system_statuses?.[s.id];
        if (st === "done" || st === "floor") ran++;
      }
      const logged = Object.keys(e.system_statuses ?? {}).length > 0;
      adherencePct.push({
        date,
        value: logged ? Math.round((ran / activeCount) * 100) : null,
      });
    } else {
      adherencePct.push({ date, value: null });
    }

    const diet = e ? readDietLog(e.meals) : null;
    protein.push({ date, value: diet && diet.protein > 0 ? diet.protein : null });
    weight.push({ date, value: diet?.weightKg ?? null });
  }

  return {
    start,
    end,
    energy,
    wakeMin,
    wakeTargetMin: targetWake,
    adherencePct,
    protein,
    proteinTarget,
    weight,
    sleepConsistencyPct:
      wakesLogged > 0 ? Math.round((wakesWithin / wakesLogged) * 100) : null,
  };
}
