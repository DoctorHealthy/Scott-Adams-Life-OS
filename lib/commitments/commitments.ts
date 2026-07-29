// Weekly commitments (R4). Fixed Monday-start weeks; everything judged in
// code from the logs. Passed the moment the target is met, failed when the
// week ends short, never negotiated by the AI.

import { addDays } from "@/lib/constants";
import { hhmmToMin, clockDiffMin, readSleepLog, type SleepConfig } from "@/lib/sleep/sleep";
import {
  windowCount,
  type SystemTrackingLike,
  type TrackingEntryLike,
} from "@/lib/tracking/tracking";
import type { SystemStatus } from "@/lib/types";

export type CommitmentKind = "system_count" | "wake_hold";

export type CommitmentRow = {
  id: string;
  user_id: string;
  week_start: string;
  kind: CommitmentKind;
  system_id: string | null;
  target: number;
  tolerance_min: number | null;
  label: string;
  status: "active" | "passed" | "failed";
  judged_on: string | null;
  debrief: string | null;
};

export type CommitmentProgress = {
  count: number;
  target: number;
  daysLeft: number; // full days remaining in the week, incl. today
};

// The Monday of the week containing dateStr (local string math, no TZ traps).
export function weekStartOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return addDays(dateStr, -sinceMonday);
}

export function weekEndOf(weekStart: string): string {
  return addDays(weekStart, 6);
}

export type CommitmentEntryLike = TrackingEntryLike & {
  module_logs: { sleep?: unknown } | null;
};

// Progress for one commitment, entirely from the logs.
export function commitmentProgress(args: {
  c: CommitmentRow;
  entries: CommitmentEntryLike[];
  systems: (SystemTrackingLike & { name: string })[];
  sleepConfig: SleepConfig;
  today: string; // user-local
}): CommitmentProgress {
  const { c, entries, systems, sleepConfig, today } = args;
  const from = c.week_start;
  const to = weekEndOf(c.week_start);

  let count = 0;
  if (c.kind === "system_count") {
    const s = systems.find((x) => x.id === c.system_id);
    if (s) count = windowCount(s, entries, from, to);
  } else {
    // wake_hold: days in the week with a logged wake within tolerance of the
    // current wake target.
    const tol = c.tolerance_min ?? 30;
    const target = hhmmToMin(sleepConfig.currentWake);
    for (const e of entries) {
      if (e.date < from || e.date > to) continue;
      const wake = readSleepLog(
        (e.module_logs as { sleep?: unknown } | null)?.sleep
      ).wake;
      if (wake && clockDiffMin(hhmmToMin(wake), target) <= tol) count++;
    }
  }

  const daysLeft =
    today > to ? 0 : Math.max(0, 7 - Math.max(0, diffDays(from, today)));
  return { count, target: c.target, daysLeft };
}

function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) /
      86400000
  );
}

// The verdict, in code: passed as soon as the count is there, failed only
// once the week is over, otherwise still active.
export function judgeCommitment(
  progress: CommitmentProgress,
  weekStart: string,
  today: string
): "active" | "passed" | "failed" {
  if (progress.count >= progress.target) return "passed";
  if (today > weekEndOf(weekStart)) return "failed";
  return "active";
}

// A commitment is "at risk" when the remaining days cannot cover the gap at
// one per day (counters could still catch up, so only status/wake kinds).
export function commitmentAtRisk(
  c: CommitmentRow,
  p: CommitmentProgress,
  isCounterKind: boolean
): boolean {
  if (p.count >= p.target) return false;
  if (isCounterKind) return p.daysLeft <= 1;
  return p.target - p.count > p.daysLeft;
}

// ---------- momentum (28-day adherence per system) ----------

export function momentumPct(
  s: SystemTrackingLike & { created_at?: string },
  entries: TrackingEntryLike[],
  today: string
): number | null {
  const windowStart = addDays(today, -27);
  // Never count days before the system existed, so a fresh system is not
  // punished for the 28-day window it did not exist in.
  const created = s.created_at ? s.created_at.slice(0, 10) : null;
  const from = created && created > windowStart ? created : windowStart;
  const days = diffDays(from, today) + 1; // inclusive
  if (days <= 0) return null;

  if (s.cadence === "weekly" || s.metric_type === "number") {
    const target = s.target_per_week;
    if (!target) return null;
    const weeks = Math.max(1, days / 7);
    const count = windowCount(s, entries, from, today);
    return Math.min(100, Math.round((count / (target * weeks)) * 100));
  }

  // Daily: score over every day it should have run (unlogged = a miss), so a
  // habit done only occasionally no longer reads as maxed.
  let score = 0;
  for (const e of entries) {
    if (e.date < from || e.date > today) continue;
    const st = e.system_statuses?.[s.id] as SystemStatus | undefined;
    if (st === "done") score += 1;
    else if (st === "floor") score += 0.5;
  }
  return Math.min(100, Math.round((score / days) * 100));
}
