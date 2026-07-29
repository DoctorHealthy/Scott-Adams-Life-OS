// The accountability scoring engine (R6). Pure, deterministic code. It decides
// points, grades, consequences, escalation, the lock state, rewards, and the
// fund balance. The coach only reads these numbers; it never computes them and
// never negotiates a consequence.
//
// Doctrine baked in here (confirmed with Mark): a system's Min counts as a full
// point (Done-or-Min = 1, Skip / no-log = 0); running stays a punishment; a
// bad-body day waives that day's run but not the fine; the day is judged at a
// personal cutoff, not midnight.

import {
  hhmmToMin,
  readSleepLog,
  targetBedtime,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import { readCounters, windowCount } from "@/lib/tracking/tracking";
import type { SystemStatus } from "@/lib/types";
import type { ScoreConfig, ScoreGradeDay, ScoreGradeWeek } from "./config";
import { eur, exceptionKindOn } from "./config";

// ---------- inputs ----------

export type ScoredSystemLike = {
  id: string;
  name: string;
  domain: string | null;
  metric_type: string;
  cadence: "daily" | "weekly";
  target_per_week: number | null;
  unit?: string | null;
};

// A scored system is judged over the WEEK (not per day) when it is weekly
// cadence or a counter. Daily systems drive the daily grade; weekly ones are
// judged only at week end (confirmed with Mark: never daily-fined).
export function isWeeklyScored(s: {
  cadence: "daily" | "weekly";
  metric_type: string;
}): boolean {
  return s.cadence === "weekly" || s.metric_type === "number";
}

export type ScoreEntryLike = {
  date: string;
  system_statuses: Record<string, SystemStatus> | null;
  module_logs: unknown;
};

export type LedgerRowLike = {
  date: string;
  source?: string;
  kind: string; // fine | run | lock | reward | payout
  amount_eur: number | null;
  distance_km?: number | null;
  status: string; // pending | done | waived
  release_rule?: string | null;
  resolved_on?: string | null;
};

// ---------- one system, one day ----------

// The Sleep system passes when the actual bedtime is no later than target (plus
// tolerance) AND the slept duration clears the target (minus tolerance). Both
// are night-clock times, so the math wraps around midnight.
export function sleepPass(
  moduleLogs: unknown,
  sleepConfig: SleepConfig,
  tolMin: number
): boolean {
  const log = readSleepLog((moduleLogs as { sleep?: unknown } | null)?.sleep);
  if (!log.bed || !log.wake) return false;

  const targetBed = hhmmToMin(targetBedtime(sleepConfig));
  const bed = hhmmToMin(log.bed);
  let late = bed - targetBed;
  if (late > 720) late -= 1440;
  if (late < -720) late += 1440;
  const bedOk = late <= tolMin;

  let dur = hhmmToMin(log.wake) - bed;
  if (dur <= 0) dur += 1440;
  const durOk = dur >= sleepConfig.sleepHours * 60 - tolMin;

  return bedOk && durOk;
}

function isSleepDomain(domain: string | null): boolean {
  return (domain ?? "").trim().toLowerCase() === "sleep";
}

// Did this scored system earn its point on this day? Sleep uses its bed +
// duration rule; a counter needs at least one bump; everything else is
// Done-or-Min (floor counts, per correction 1).
export function systemDoneOnDay(
  s: ScoredSystemLike,
  entry: ScoreEntryLike | undefined,
  sleepConfig: SleepConfig,
  config: ScoreConfig
): boolean {
  if (!entry) return false;
  if (isSleepDomain(s.domain)) {
    return sleepPass(entry.module_logs, sleepConfig, config.sleepToleranceMin);
  }
  if (s.metric_type === "number") {
    return (readCounters(entry.module_logs)[s.id] ?? 0) >= 1;
  }
  const st = entry.system_statuses?.[s.id];
  return st === "done" || st === "floor";
}

// ---------- day score + grade ----------

export type DayScore = {
  date: string;
  points: number;
  max: number;
  perSystem: { id: string; name: string; done: boolean }[];
  excused: boolean; // a full exception: no penalty, excluded from the week
};

export function dayScore(args: {
  date: string;
  entry: ScoreEntryLike | undefined;
  systems: ScoredSystemLike[];
  sleepConfig: SleepConfig;
  config: ScoreConfig;
}): DayScore {
  const { date, entry, systems, sleepConfig, config } = args;
  // Only DAILY scored systems drive the daily grade. Weekly-target systems are
  // judged over the week, so they never cost a daily point (or a daily fine).
  const daily = systems.filter((s) => !isWeeklyScored(s));
  const perSystem = daily.map((s) => ({
    id: s.id,
    name: s.name,
    done: systemDoneOnDay(s, entry, sleepConfig, config),
  }));
  const points = perSystem.filter((p) => p.done).length;
  return {
    date,
    points,
    max: daily.length,
    perSystem,
    excused: exceptionKindOn(config, date) === "excused",
  };
}

// Proportional bands. For max = 4 this reproduces the doc exactly
// (4 Perfect, 3 Green, 2 Yellow, 1 Red, 0 Critical).
export function dayGrade(points: number, max: number): ScoreGradeDay {
  if (max <= 0) return "Perfect"; // no daily systems to miss = vacuously clean
  if (points >= max) return "Perfect";
  const pct = points / max;
  if (pct >= 0.75) return "Green";
  if (pct >= 0.5) return "Yellow";
  if (points > 0) return "Red";
  return "Critical";
}

// A green day (>= 75%) is what releases an entertainment lock.
export function isGreenDay(points: number, max: number): boolean {
  const g = dayGrade(points, max);
  return g === "Perfect" || g === "Green";
}

// ---------- week score + grade ----------

// Doc thresholds over 28 (S 28, A 25-27, B 22-24, C 18-21, D 14-17, F 0-13),
// scaled to any max by integer cross-multiplication (no float boundary bugs).
export function weekGrade(points: number, max: number): ScoreGradeWeek {
  if (max <= 0) return "S"; // no daily systems this week = vacuously clean
  if (points >= max) return "S";
  const p = points * 28;
  if (p >= max * 25) return "A";
  if (p >= max * 22) return "B";
  if (p >= max * 18) return "C";
  if (p >= max * 14) return "D";
  return "F";
}

export const WEEK_GRADES: ScoreGradeWeek[] = ["S", "A", "B", "C", "D", "F"];

// A 0/4 day drops the week one grade (doc). Multiple critical days stack, floored at F.
export function demoteWeekGrade(g: ScoreGradeWeek, steps: number): ScoreGradeWeek {
  const i = WEEK_GRADES.indexOf(g);
  const j = Math.min(WEEK_GRADES.length - 1, i + Math.max(0, steps));
  return WEEK_GRADES[j];
}

export type WeekScore = {
  weekStart: string;
  points: number;
  max: number;
  days: DayScore[];
  criticalDays: number;
  baseGrade: ScoreGradeWeek;
  grade: ScoreGradeWeek; // after critical-day demotion
};

export function weekScore(weekStart: string, days: DayScore[]): WeekScore {
  const active = days.filter((d) => !d.excused);
  const points = active.reduce((a, d) => a + d.points, 0);
  const max = active.reduce((a, d) => a + d.max, 0);
  const criticalDays = active.filter((d) => d.max > 0 && d.points === 0).length;
  const baseGrade = weekGrade(points, max);
  return {
    weekStart,
    points,
    max,
    days,
    criticalDays,
    baseGrade,
    grade: demoteWeekGrade(baseGrade, criticalDays),
  };
}

// ---------- weekly-tracked scored systems ----------

export type WeeklySystemResult = {
  id: string;
  name: string;
  unit: string | null;
  count: number;
  target: number | null;
  met: boolean;
};

// Weekly scored systems judged over [from, to] inclusive. `met` is true once
// the count reaches the target (or when no target is set). Used for display and
// for the week-end miss fine.
export function weeklySystemResults(
  systems: ScoredSystemLike[],
  entries: ScoreEntryLike[],
  from: string,
  to: string
): WeeklySystemResult[] {
  return systems.filter(isWeeklyScored).map((s) => {
    const count = windowCount(s, entries, from, to);
    const target = s.target_per_week;
    return {
      id: s.id,
      name: s.name,
      unit: s.unit ?? null,
      count,
      target,
      met: target == null ? true : count >= target,
    };
  });
}

// ---------- consequences ----------

export type Consequence =
  | { kind: "fine"; amountEur: number; label: string; source: "day" | "week" }
  | {
      kind: "run";
      distanceKm: number;
      label: string;
      source: "day" | "week";
      waived: boolean;
    }
  | {
      kind: "lock";
      releaseRule: "green" | "green3";
      label: string;
      source: "day" | "week";
    }
  | { kind: "reward"; label: string; source: "day" | "week" };

export function consequencesForDay(
  grade: ScoreGradeDay,
  config: ScoreConfig,
  badBody: boolean
): Consequence[] {
  const out: Consequence[] = [];
  if (grade === "Perfect") return out;

  out.push({
    kind: "fine",
    amountEur: config.dailyFine,
    source: "day",
    label: `Day ${grade}. ${eur(config.dailyFine)} to the ${config.fund.name}.`,
  });

  if (config.runsEnabled) {
    const km =
      grade === "Yellow"
        ? config.dailyRunKm.yellow
        : grade === "Red"
          ? config.dailyRunKm.red
          : grade === "Critical"
            ? config.dailyRunKm.critical
            : 0;
    if (km > 0) {
      const waived = badBody && config.runsWaiverAllowed;
      out.push({
        kind: "run",
        distanceKm: km,
        source: "day",
        waived,
        label: waived ? `${km} km run (waived: bad-body day).` : `${km} km run.`,
      });
    }
  }

  if (grade === "Red" || grade === "Critical") {
    out.push({
      kind: "lock",
      releaseRule: "green",
      source: "day",
      label: "Entertainment locked until a Green day.",
    });
  }
  return out;
}

export function consequencesForWeek(
  grade: ScoreGradeWeek,
  config: ScoreConfig
): Consequence[] {
  const out: Consequence[] = [];
  const fund = config.fund.name;

  if (grade === "S") {
    out.push({ kind: "reward", source: "week", label: config.rewardCatalog.sWeek });
    return out;
  }
  if (grade === "A") return out;

  if (grade === "B") {
    out.push({ kind: "fine", amountEur: config.weeklyFines.B, source: "week", label: `Week B. ${eur(config.weeklyFines.B)} to the ${fund}.` });
    return out;
  }
  if (grade === "C") {
    out.push({ kind: "fine", amountEur: config.weeklyFines.C, source: "week", label: `Week C. ${eur(config.weeklyFines.C)} to the ${fund}.` });
    if (config.runsEnabled)
      out.push({ kind: "run", distanceKm: config.weeklyRunKm.C, source: "week", waived: false, label: `${config.weeklyRunKm.C} km run (week C).` });
    return out;
  }
  if (grade === "D") {
    out.push({ kind: "fine", amountEur: config.weeklyFines.D, source: "week", label: `Week D. ${eur(config.weeklyFines.D)} to the ${fund}.` });
    out.push({ kind: "lock", releaseRule: "green", source: "week", label: "Entertainment locked until the first Green day." });
    return out;
  }
  // F
  out.push({ kind: "fine", amountEur: config.weeklyFines.F, source: "week", label: `Week F. ${eur(config.weeklyFines.F)} to the ${fund}.` });
  if (config.runsEnabled)
    out.push({ kind: "run", distanceKm: config.weeklyRunKm.F, source: "week", waived: false, label: `${config.weeklyRunKm.F} km run (week F).` });
  out.push({ kind: "lock", releaseRule: "green3", source: "week", label: "Entertainment locked until three consecutive Green days." });
  return out;
}

// ---------- escalation ----------
// The doc: three identical consequences in a row -> the next one steps up. A
// successful week (A or S) resets the streak. `prior*` arrays are the magnitudes
// of earlier same-kind consequences since the last reset, most-recent-first.

export function escalateFine(
  base: number,
  priorFineAmounts: number[],
  config: ScoreConfig
): number {
  if (!config.escalationEnabled) return base;
  let consec = 0;
  for (const a of priorFineAmounts) {
    if (a === base) consec++;
    else break;
  }
  return consec >= 3 ? base + config.escalationFineStep : base;
}

export function escalateRun(
  base: number,
  priorRunKm: number[],
  config: ScoreConfig
): number {
  if (!config.escalationEnabled) return base;
  let consec = 0;
  for (const d of priorRunKm) {
    if (d === base) consec++;
    else break;
  }
  return consec >= 3 ? base + config.escalationRunStepKm : base;
}

// ---------- entertainment lock (live, from the ledger + judged day grades) ----------

export type LockState = {
  locked: boolean;
  rule: "green" | "green3" | null;
  since: string | null;
};

// The latest non-waived lock governs. It releases once enough consecutive green
// days have been judged AFTER the lock's date (1 for a normal lock, 3 for an F).
// Computed live so the UI is right even between cron runs; the cron also writes
// resolved_on so the partner's stored view matches.
export function computeLock(
  ledger: LedgerRowLike[],
  greensByDateAsc: { date: string; green: boolean }[]
): LockState {
  // Only a PENDING lock is active. A lifted lock (status done, via liftLock or
  // the cron's green-day release) or a waived one is resolved and never
  // re-locks, no matter what the green-day history looks like.
  const locks = ledger
    .filter((r) => r.kind === "lock" && r.status === "pending")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (locks.length === 0) return { locked: false, rule: null, since: null };

  const lock = locks[locks.length - 1];
  const rule = (lock.release_rule === "green3" ? "green3" : "green") as "green" | "green3";
  const need = rule === "green3" ? 3 : 1;

  let streak = 0;
  let released = false;
  for (const d of greensByDateAsc) {
    if (d.date <= lock.date) continue;
    if (d.green) {
      streak++;
      if (streak >= need) {
        released = true;
        break;
      }
    } else {
      streak = 0;
    }
  }
  return { locked: !released, rule, since: lock.date };
}

// ---------- fund ----------

// Money actually moved into the fund (paid fines) minus what has been spent.
export function fundBalance(ledger: LedgerRowLike[]): number {
  let bal = 0;
  for (const r of ledger) {
    if (r.kind === "fine" && r.status === "done") bal += Number(r.amount_eur ?? 0);
    else if (r.kind === "payout") bal -= Number(r.amount_eur ?? 0);
  }
  return Math.round(bal * 100) / 100;
}

// Total ever contributed (all paid fines), for a lifetime figure.
export function fundContributed(ledger: LedgerRowLike[]): number {
  let sum = 0;
  for (const r of ledger) {
    if (r.kind === "fine" && r.status === "done") sum += Number(r.amount_eur ?? 0);
  }
  return Math.round(sum * 100) / 100;
}

export function fundProgressPct(balance: number, targetEur: number | null): number | null {
  if (!targetEur || targetEur <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((balance / targetEur) * 100)));
}

export function pendingByKind(
  ledger: LedgerRowLike[],
  kind: "fine" | "run"
): LedgerRowLike[] {
  return ledger.filter((r) => r.kind === kind && r.status === "pending");
}

export function pendingFinesTotal(ledger: LedgerRowLike[]): number {
  return Math.round(
    pendingByKind(ledger, "fine").reduce((a, r) => a + Number(r.amount_eur ?? 0), 0) * 100
  ) / 100;
}

// ---------- grade colour band for the UI (name -> semantic tone) ----------

export function dayGradeTone(g: ScoreGradeDay): "green" | "yellow" | "red" | "black" {
  if (g === "Perfect" || g === "Green") return "green";
  if (g === "Yellow") return "yellow";
  if (g === "Red") return "red";
  return "black";
}

export function weekGradeTone(g: ScoreGradeWeek): "green" | "yellow" | "red" | "black" {
  if (g === "S" || g === "A") return "green";
  if (g === "B" || g === "C") return "yellow";
  if (g === "D") return "red";
  return "black";
}
