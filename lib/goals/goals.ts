// Goals: direction and progress over the year, by quarter. Progress is derived
// in code from linked systems where possible, manual otherwise. The AI never
// computes goal progress.

import { hhmmToMin, type SleepConfig } from "@/lib/sleep/sleep";

export type Quarter = 1 | 2 | 3 | 4;

export type GoalLink =
  | "manual"
  | "sleep_wake" // from the sleep-shift step
  | "training_sessions" // sessions per week vs target
  | "diet_protein"; // recent protein adherence

export type Milestone = { id: string; text: string; done: boolean };

export type Goal = {
  id: string;
  title: string;
  why: string; // one-word cue
  quarter: Quarter;
  year: number;
  link: GoalLink;
  manualProgress: number; // 0-100, used when link === "manual"
  notes: string;
  milestones: Milestone[];
};

export const LINK_LABELS: { value: GoalLink; label: string }[] = [
  { value: "manual", label: "Manual / milestones" },
  { value: "sleep_wake", label: "Linked: sleep-shift step" },
  { value: "training_sessions", label: "Linked: sessions per week" },
  { value: "diet_protein", label: "Linked: protein adherence" },
];

export function readGoals(
  coachingPrefs: Record<string, unknown> | null | undefined
): Goal[] {
  const g = coachingPrefs?.goals;
  if (!Array.isArray(g)) return [];
  return (g as Goal[]).filter(
    (x) => x && typeof x.id === "string" && typeof x.title === "string"
  );
}

export function currentQuarter(dateStr: string): Quarter {
  const m = Number(dateStr.split("-")[1]) || 1;
  return (Math.floor((m - 1) / 3) + 1) as Quarter;
}

export function currentYear(dateStr: string): number {
  return Number(dateStr.split("-")[0]) || new Date().getFullYear();
}

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
