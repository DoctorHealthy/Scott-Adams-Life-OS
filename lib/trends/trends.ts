// Trend metrics, all computed in code from the entries (and, for goals, from the
// stored review snapshots). The trends page picks which of these to chart. The
// AI never derives a series or a number here.

import { addDays } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { readDietLog } from "@/lib/diet/log";
import {
  hhmmToMin,
  clockDiffMin,
  readSleepLog,
  targetBedtime,
  WAKE_TOLERANCE_MIN,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import type { EffectiveTargets } from "@/lib/diet/config";
import type { Goal } from "@/lib/goals/goals";
import { isWeeklyTracked, weeklyCount } from "@/lib/tracking/tracking";

export type Point = { date: string; value: number | null };

export type MetricGroup = "Core" | "Sleep" | "Diet" | "Systems" | "Goals";

// One chart's worth of data, fully resolved server-side so the client just
// renders it (no series logic shipped twice, no stale-CSS style pitfalls).
export type SeriesPayload = {
  key: string;
  label: string;
  group: MetricGroup;
  points: Point[];
  unit?: string;
  target?: number | null;
  targetLabel?: string;
  yMinHint?: number;
  yMaxHint?: number;
  isTime?: boolean; // value is minutes-after-midnight, render as HH:MM
  summary?: string;
};

export type TrendEntry = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: unknown;
  module_logs: { sleep?: unknown; exercise?: unknown } | null;
};

export type ReviewSnapshot = {
  period_end: string;
  goalSnapshot: { id: string; progress: number }[];
};

type DailyRecord = {
  date: string;
  energy: number | null;
  wakeMin: number | null;
  bedMin: number | null;
  sleepDurH: number | null;
  adherencePct: number | null;
  kcal: number | null;
  protein: number | null;
  waterMl: number | null;
  weight: number | null;
  statuses: Record<string, SystemStatus>;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildRecords(
  dateList: string[],
  entries: TrendEntry[],
  systems: System[]
): DailyRecord[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  // Daily adherence only judges daily systems; weekly-tracked ones have their
  // own per-week series below.
  const dailySystems = systems.filter((s) => !isWeeklyTracked(s));
  const activeCount = dailySystems.length;

  return dateList.map((date) => {
    const e = byDate.get(date);
    const sleep = e ? readSleepLog(e.module_logs?.sleep) : null;
    const wakeMin = sleep?.wake ? hhmmToMin(sleep.wake) : null;
    const bedMin = sleep?.bed ? hhmmToMin(sleep.bed) : null;
    const sleepDurH =
      wakeMin != null && bedMin != null
        ? round1((((wakeMin - bedMin) % 1440) + 1440) % 1440 / 60)
        : null;

    let adherencePct: number | null = null;
    const statuses = e?.system_statuses ?? {};
    if (e && activeCount > 0 && Object.keys(statuses).length > 0) {
      let ran = 0;
      for (const s of dailySystems) {
        const st = statuses[s.id];
        if (st === "done" || st === "floor") ran++;
      }
      adherencePct = Math.round((ran / activeCount) * 100);
    }

    const diet = e ? readDietLog(e.meals) : null;

    return {
      date,
      energy: e?.energy_1_10 ?? null,
      wakeMin,
      bedMin,
      sleepDurH,
      adherencePct,
      kcal: diet && diet.kcal > 0 ? diet.kcal : null,
      protein: diet && diet.protein > 0 ? diet.protein : null,
      waterMl: diet && diet.waterMl > 0 ? diet.waterMl : null,
      weight: diet?.weightKg ?? null,
      statuses,
    };
  });
}

// Build every available series. The page passes the whole set to the client,
// which shows the user-selected subset.
export function buildAllSeries(args: {
  end: string;
  days: number;
  entries: TrendEntry[];
  systems: System[];
  sleepConfig: SleepConfig;
  targets: EffectiveTargets;
  goals: Goal[];
  reviews: ReviewSnapshot[];
}): SeriesPayload[] {
  const { end, days, entries, systems, sleepConfig, targets, goals, reviews } = args;
  const start = addDays(end, -(days - 1));
  const dateList: string[] = [];
  for (let i = 0; i < days; i++) dateList.push(addDays(start, i));

  const records = buildRecords(dateList, entries, systems);
  const targetWake = hhmmToMin(sleepConfig.currentWake);

  const pts = (fn: (r: DailyRecord) => number | null): Point[] =>
    records.map((r) => ({ date: r.date, value: fn(r) }));

  const out: SeriesPayload[] = [];

  // ----- Core -----
  out.push({
    key: "energy",
    label: "Energy",
    group: "Core",
    points: pts((r) => r.energy),
    unit: "/ 10",
    yMinHint: 1,
    yMaxHint: 10,
  });
  out.push({
    key: "adherence",
    label: "System adherence",
    group: "Core",
    points: pts((r) => r.adherencePct),
    unit: "%",
    yMinHint: 0,
    yMaxHint: 100,
  });

  // ----- Sleep -----
  let wakesLogged = 0;
  let wakesWithin = 0;
  for (const r of records) {
    if (r.wakeMin != null) {
      wakesLogged++;
      if (clockDiffMin(r.wakeMin, targetWake) <= WAKE_TOLERANCE_MIN) wakesWithin++;
    }
  }
  // Time-of-day charts anchor to a stable window around the target (target
  // plus or minus 3 hours) so the target line sits mid-chart and the line
  // reads as "above or below target," not auto-zoomed noise.
  const TIME_WINDOW = 180;
  const bedTarget = hhmmToMin(targetBedtime(sleepConfig));
  out.push({
    key: "wake",
    label: "Wake time",
    group: "Sleep",
    points: pts((r) => r.wakeMin),
    target: targetWake,
    targetLabel: `target ${sleepConfig.currentWake}`,
    isTime: true,
    yMinHint: targetWake - TIME_WINDOW,
    yMaxHint: targetWake + TIME_WINDOW,
    summary:
      wakesLogged > 0
        ? `Wake consistency: ${Math.round(
            (wakesWithin / wakesLogged) * 100
          )}% of logged wakes within 30 min of target. Below the line is earlier.`
        : undefined,
  });
  out.push({
    key: "bed",
    label: "Bedtime",
    group: "Sleep",
    points: pts((r) => r.bedMin),
    target: bedTarget,
    targetLabel: `target ${targetBedtime(sleepConfig)}`,
    isTime: true,
    yMinHint: bedTarget - TIME_WINDOW,
    yMaxHint: bedTarget + TIME_WINDOW,
    summary: "Below the line is earlier than target.",
  });
  out.push({
    key: "sleepDuration",
    label: "Sleep duration",
    group: "Sleep",
    points: pts((r) => r.sleepDurH),
    unit: "h",
    target: sleepConfig.sleepHours,
    targetLabel: `target ${sleepConfig.sleepHours} h`,
  });

  // ----- Diet -----
  out.push({
    key: "calories",
    label: "Calories",
    group: "Diet",
    points: pts((r) => r.kcal),
    unit: "kcal",
    target: targets.leanGain,
    targetLabel: targets.leanGain != null ? `target ${targets.leanGain}` : undefined,
  });
  out.push({
    key: "protein",
    label: "Protein",
    group: "Diet",
    points: pts((r) => r.protein),
    unit: "g",
    target: targets.protein,
    targetLabel: targets.protein != null ? `target ${targets.protein} g` : undefined,
  });
  out.push({
    key: "water",
    label: "Water",
    group: "Diet",
    points: pts((r) => r.waterMl),
    unit: "ml",
    target: targets.waterMl,
    targetLabel: targets.waterMl != null ? `target ${targets.waterMl} ml` : undefined,
  });
  out.push({
    key: "weight",
    label: "Weight",
    group: "Diet",
    points: pts((r) => r.weight),
    unit: "kg",
    summary: "Log it in the Diet row when you weigh in.",
  });

  // ----- Systems -----
  for (const s of systems) {
    if (isWeeklyTracked(s)) {
      // Rolling last-7 count vs the weekly target.
      const points: Point[] = dateList.map((d) => ({
        date: d,
        value: weeklyCount(s, entries, d),
      }));
      out.push({
        key: `system:${s.id}`,
        label: `${s.name} per week`,
        group: "Systems",
        points,
        unit: s.unit ?? "/ week",
        target: s.target_per_week,
        targetLabel:
          s.target_per_week != null ? `target ${s.target_per_week}` : undefined,
        yMinHint: 0,
        summary: "Rolling 7-day total.",
      });
      continue;
    }

    // Daily systems: 7-day rolling adherence.
    const points: Point[] = records.map((_, i) => {
      let num = 0;
      let den = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const st = records[j].statuses[s.id];
        if (!st) continue;
        den++;
        if (st === "done") num += 1;
        else if (st === "floor") num += 0.5;
      }
      return {
        date: records[i].date,
        value: den > 0 ? Math.round((num / den) * 100) : null,
      };
    });
    out.push({
      key: `system:${s.id}`,
      label: `${s.name} adherence`,
      group: "Systems",
      points,
      unit: "%",
      yMinHint: 0,
      yMaxHint: 100,
      summary: "7-day rolling adherence (done counts full, min counts half).",
    });
  }

  // ----- Goals (carry-forward from stored review snapshots) -----
  const sortedReviews = [...reviews].sort((a, b) =>
    a.period_end < b.period_end ? -1 : 1
  );
  for (const g of goals) {
    const points: Point[] = dateList.map((date) => {
      let val: number | null = null;
      for (const rv of sortedReviews) {
        if (rv.period_end > date) break;
        const snap = rv.goalSnapshot?.find((x) => x.id === g.id);
        if (snap) val = snap.progress;
      }
      return { date, value: val };
    });
    out.push({
      key: `goal:${g.id}`,
      label: `${g.title} progress`,
      group: "Goals",
      points,
      unit: "%",
      yMinHint: 0,
      yMaxHint: 100,
      summary: "Progress captured at each weekly or monthly review.",
    });
  }

  return out;
}
