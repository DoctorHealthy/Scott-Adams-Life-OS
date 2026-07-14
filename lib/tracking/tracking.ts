// Flexible tracking (R3), all in code. Weekly systems are judged over a
// rolling last-7-days window (consistent with sessions and protein); counted
// systems (metric_type 'number') bump a per-day counter stored in
// entries.module_logs.counters. The AI reads these numbers, never makes them.

import type { SystemStatus } from "@/lib/types";
import { addDays } from "@/lib/constants";

export type CounterMap = Record<string, number>; // system id -> count that day

export type SystemTrackingLike = {
  id: string;
  cadence: "daily" | "weekly";
  metric_type: string;
  target_per_week: number | null;
};

export function isCounter(s: Pick<SystemTrackingLike, "metric_type">): boolean {
  return s.metric_type === "number";
}

export function isWeekly(s: Pick<SystemTrackingLike, "cadence">): boolean {
  return s.cadence === "weekly";
}

// A system tracked over the week rather than the day (weekly cadence, or a
// counter, whose total only means something across days).
export function isWeeklyTracked(
  s: Pick<SystemTrackingLike, "cadence" | "metric_type">
): boolean {
  return isWeekly(s) || isCounter(s);
}

export function readCounters(moduleLogs: unknown): CounterMap {
  if (moduleLogs && typeof moduleLogs === "object") {
    const c = (moduleLogs as { counters?: unknown }).counters;
    if (c && typeof c === "object") {
      const out: CounterMap = {};
      for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
      }
      return out;
    }
  }
  return {};
}

export type TrackingEntryLike = {
  date: string;
  system_statuses: Record<string, SystemStatus> | null;
  module_logs: unknown;
};

// How many times this system happened inside a fixed date window (inclusive):
// counters sum their bumps; status systems count done/Min days.
export function windowCount(
  s: SystemTrackingLike,
  entries: TrackingEntryLike[],
  from: string,
  to: string
): number {
  let total = 0;
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    if (isCounter(s)) {
      total += readCounters(e.module_logs)[s.id] ?? 0;
    } else {
      const st = e.system_statuses?.[s.id];
      if (st === "done" || st === "floor") total++;
    }
  }
  return total;
}

// Rolling last-7 window ending at `end` (inclusive).
export function weeklyCount(
  s: SystemTrackingLike,
  entries: TrackingEntryLike[],
  end: string
): number {
  return windowCount(s, entries, addDays(end, -6), end);
}

export type WeeklyProgress = { count: number; target: number | null };

export function weeklyCountsFor(
  systems: SystemTrackingLike[],
  entries: TrackingEntryLike[],
  end: string
): Record<string, WeeklyProgress> {
  const out: Record<string, WeeklyProgress> = {};
  for (const s of systems) {
    if (!isWeeklyTracked(s)) continue;
    out[s.id] = { count: weeklyCount(s, entries, end), target: s.target_per_week };
  }
  return out;
}
