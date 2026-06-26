// The day's plan, assembled entirely in code. The coach narrates this; it never
// invents any of these numbers or items.

import { targetBedtime, atGoal, type SleepConfig } from "@/lib/sleep/sleep";
import type { ExerciseConfig } from "@/lib/exercise/exercise";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets } from "@/lib/diet/config";
import { gemForDate, type Gem } from "@/lib/mind/gems";

export type PlanMeal = { name: string; kcal: number; protein: number };

export type DayPlan = {
  date: string;
  sleep: { wake: string; bed: string; goalWake: string; atGoal: boolean };
  morningBlock: string[];
  session: string;
  meals: PlanMeal[];
  targets: { kcal: number | null; protein: number | null; waterMl: number | null };
  gem: Gem;
};

function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Suggest today's session by rotating the menu by date. Deterministic.
export function sessionForDate(cfg: ExerciseConfig, dateStr: string): string {
  const types = cfg.sessionTypes;
  if (!types.length) return "Floor only (warm-up + ankle + walk)";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return types[0].label;
  return types[((dayNumber(dateStr) % types.length) + types.length) % types.length].label;
}

export function buildPlan(args: {
  date: string;
  sleepConfig: SleepConfig;
  morningBlock: string[];
  exerciseConfig: ExerciseConfig;
  dietCatalog: DietMeal[];
  targets: EffectiveTargets;
}): DayPlan {
  const { date, sleepConfig, morningBlock, exerciseConfig, dietCatalog, targets } =
    args;
  return {
    date,
    sleep: {
      wake: sleepConfig.currentWake,
      bed: targetBedtime(sleepConfig),
      goalWake: sleepConfig.goalWake,
      atGoal: atGoal(sleepConfig),
    },
    morningBlock,
    session: sessionForDate(exerciseConfig, date),
    meals: dietCatalog.map((m) => ({
      name: m.name,
      kcal: m.kcal,
      protein: m.protein,
    })),
    targets: {
      kcal: targets.leanGain,
      protein: targets.protein,
      waterMl: targets.waterMl,
    },
    gem: gemForDate(date),
  };
}
