// Goals: direction and progress over the year, by quarter. Stored in the
// goals table (spec section 14). Progress is derived in code from the linked
// system where possible, manual otherwise. The AI never computes goal progress.

import { hhmmToMin, type SleepConfig } from "@/lib/sleep/sleep";
import {
  computeExerciseStats,
  readExerciseLog,
  type ExerciseConfig,
} from "@/lib/exercise/exercise";
import { readDietLog } from "@/lib/diet/log";

export type Quarter = 1 | 2 | 3 | 4;

// What an auto-linked goal reads. Resolved from the linked system's domain,
// never stored: Sleep -> the sleep-shift step, Exercise -> sessions per week,
// Diet -> protein adherence.
export type GoalLink =
  | "manual"
  | "sleep_wake"
  | "training_sessions"
  | "diet_protein";

export type Milestone = { id: string; text: string; done: boolean };

export type Goal = {
  id: string;
  title: string;
  why: string; // one-word cue
  quarter: Quarter;
  year: number;
  linkedSystemId: string | null;
  link: GoalLink; // resolved from the linked system's domain
  manualProgress: number; // 0-100, used when link === "manual"
  notes: string;
  milestones: Milestone[];
  status: "active" | "done" | "dropped";
};

// ---------- DB row mapping ----------

export type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  why: string;
  target_year: number;
  target_quarter: number;
  progress_type: "manual" | "auto";
  linked_system_id: string | null;
  manual_progress: number;
  milestones: unknown;
  notes: string;
  status: "active" | "done" | "dropped";
};

type SystemLike = { id: string; name: string; domain: string | null };

export function linkKindForDomain(domain: string | null | undefined): GoalLink {
  switch (domain) {
    case "Sleep":
      return "sleep_wake";
    case "Exercise":
      return "training_sessions";
    case "Diet":
      return "diet_protein";
    default:
      return "manual";
  }
}

function readMilestones(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Milestone[]).filter(
    (m) => m && typeof m.id === "string" && typeof m.text === "string"
  );
}

export function goalFromRow(row: GoalRow, systems: SystemLike[]): Goal {
  const linked = row.linked_system_id
    ? systems.find((s) => s.id === row.linked_system_id) ?? null
    : null;
  return {
    id: row.id,
    title: row.title,
    why: row.why ?? "",
    quarter: (Math.min(4, Math.max(1, row.target_quarter)) || 1) as Quarter,
    year: row.target_year,
    linkedSystemId: linked?.id ?? null,
    link: linked ? linkKindForDomain(linked.domain) : "manual",
    manualProgress: row.manual_progress ?? 0,
    notes: row.notes ?? "",
    milestones: readMilestones(row.milestones),
    status: row.status ?? "active",
  };
}

export function rowFromGoal(
  goal: Goal,
  userId: string
): Omit<GoalRow, "milestones"> & { milestones: Milestone[] } {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    why: goal.why,
    target_year: goal.year,
    target_quarter: goal.quarter,
    progress_type: goal.linkedSystemId && goal.link !== "manual" ? "auto" : "manual",
    linked_system_id: goal.link === "manual" ? null : goal.linkedSystemId,
    manual_progress: Math.max(0, Math.min(100, Math.round(goal.manualProgress))),
    milestones: goal.milestones,
    notes: goal.notes,
    status: goal.status,
  };
}

// Options for the "Progress source" select: manual plus every system whose
// domain supports an auto derivation.
export type LinkChoice = { value: string; label: string; kind: GoalLink };

export function linkChoices(systems: SystemLike[]): LinkChoice[] {
  const out: LinkChoice[] = [
    { value: "", label: "Manual / milestones", kind: "manual" },
  ];
  for (const s of systems) {
    const kind = linkKindForDomain(s.domain);
    if (kind === "manual") continue;
    const what =
      kind === "sleep_wake"
        ? "sleep-shift step"
        : kind === "training_sessions"
          ? "sessions per week"
          : "protein adherence";
    out.push({ value: s.id, label: `Linked: ${s.name} (${what})`, kind });
  }
  return out;
}

// ---------- calendar helpers ----------

export function currentQuarter(dateStr: string): Quarter {
  const m = Number(dateStr.split("-")[1]) || 1;
  return (Math.floor((m - 1) / 3) + 1) as Quarter;
}

export function currentYear(dateStr: string): number {
  return Number(dateStr.split("-")[0]) || new Date().getFullYear();
}

// ---------- progress, all in code ----------

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type ProgressInputs = {
  sleepConfig: SleepConfig;
  sessionsLast7: number;
  sessionsTarget: number;
  proteinDaysHit: number;
  proteinDaysLogged: number;
};

// One shared computation for every surface that shows goal progress
// (Today card, the /goals board). Reads the recent entries; code only.
export function computeGoalProgressInputs(args: {
  date: string;
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  proteinTarget: number | null;
  recent: { date: string; meals: unknown; module_logs: { exercise?: unknown } | null }[];
}): ProgressInputs {
  const { date, sleepConfig, exerciseConfig, proteinTarget, recent } = args;
  const exStats = computeExerciseStats(
    exerciseConfig,
    recent.map((r) => ({ date: r.date, log: readExerciseLog(r.module_logs?.exercise) })),
    date
  );
  const last7 = recent.filter((r) => r.date <= date).slice(0, 7);
  const proteinDaysLogged = last7.filter((r) => readDietLog(r.meals).protein > 0).length;
  const proteinDaysHit =
    proteinTarget == null
      ? 0
      : last7.filter((r) => readDietLog(r.meals).protein >= proteinTarget * 0.9).length;
  return {
    sleepConfig,
    sessionsLast7: exStats.sessionsLast7,
    sessionsTarget: exStats.sessionsTarget,
    proteinDaysHit,
    proteinDaysLogged,
  };
}

export function goalProgress(goal: Goal, inp: ProgressInputs): number {
  switch (goal.link) {
    case "sleep_wake": {
      const start = hhmmToMin(inp.sleepConfig.startWake);
      const cur = hhmmToMin(inp.sleepConfig.currentWake);
      const goalMin = hhmmToMin(inp.sleepConfig.goalWake);
      const span = start - goalMin;
      if (span <= 0) return 100;
      return clampPct(((start - cur) / span) * 100);
    }
    case "training_sessions": {
      if (inp.sessionsTarget <= 0) return 0;
      return clampPct((inp.sessionsLast7 / inp.sessionsTarget) * 100);
    }
    case "diet_protein": {
      if (inp.proteinDaysLogged <= 0) return 0;
      return clampPct((inp.proteinDaysHit / inp.proteinDaysLogged) * 100);
    }
    case "manual":
    default: {
      // If there are milestones, derive from them; else use the manual number.
      if (goal.milestones.length > 0) {
        const done = goal.milestones.filter((m) => m.done).length;
        return clampPct((done / goal.milestones.length) * 100);
      }
      return clampPct(goal.manualProgress);
    }
  }
}
