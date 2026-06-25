import { DEFAULT_MEALS, type DietMeal } from "./meals";
import type { Targets } from "./targets";

// User's diet setup, stored under users.coaching_prefs.diet (no schema change).
// Targets here are OVERRIDES; null/absent means "use the code-computed value".

export type DietWindow = { meal1: string; meal2: string; meal3: string };

export type TargetOverride = {
  maintenance: number | null;
  leanGain: number | null;
  protein: number | null;
  waterMl: number | null;
};

export type DietConfig = {
  menu: string[]; // rotation: catalog ids
  window: DietWindow;
  meals: DietMeal[]; // the catalog (seeded from defaults, then user-owned)
  targets: TargetOverride;
};

export const DEFAULT_WINDOW: DietWindow = {
  meal1: "12:30",
  meal2: "16:30",
  meal3: "19:30",
};

export const EMPTY_OVERRIDE: TargetOverride = {
  maintenance: null,
  leanGain: null,
  protein: null,
  waterMl: null,
};

export function readDietConfig(
  coachingPrefs: Record<string, unknown> | null | undefined
): DietConfig {
  const d = (coachingPrefs?.diet ?? {}) as Partial<DietConfig>;
  return {
    menu: Array.isArray(d.menu) ? d.menu : [],
    window: { ...DEFAULT_WINDOW, ...(d.window ?? {}) },
    meals:
      Array.isArray(d.meals) && d.meals.length > 0
        ? (d.meals as DietMeal[])
        : DEFAULT_MEALS,
    targets: { ...EMPTY_OVERRIDE, ...(d.targets ?? {}) },
  };
}

export type EffectiveTargets = {
  maintenance: number | null;
  leanGain: number | null;
  protein: number | null;
  waterMl: number | null;
};

// Override wins when set, otherwise the code-computed value.
export function effectiveTargets(
  computed: Targets,
  override: TargetOverride
): EffectiveTargets {
  return {
    maintenance: override.maintenance ?? computed.maintenance,
    leanGain: override.leanGain ?? computed.leanGain,
    protein: override.protein ?? computed.protein,
    waterMl: override.waterMl ?? computed.waterMl,
  };
}
