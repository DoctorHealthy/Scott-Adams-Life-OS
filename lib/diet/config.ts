// User's diet setup: which meals are in the rotation, and the eating-window
// times. Stored under users.coaching_prefs.diet so no schema change is needed.

export type DietWindow = { meal1: string; meal2: string; meal3: string };
export type DietConfig = { menu: string[]; window: DietWindow };

// Front-loaded, last meal well before bed. The sleep campaign pulls these
// earlier over time; these are the starting defaults.
export const DEFAULT_WINDOW: DietWindow = {
  meal1: "12:30",
  meal2: "16:30",
  meal3: "19:30",
};

export function readDietConfig(
  coachingPrefs: Record<string, unknown> | null | undefined
): DietConfig {
  const d = (coachingPrefs?.diet ?? {}) as Partial<DietConfig>;
  return {
    menu: Array.isArray(d.menu) ? d.menu : [],
    window: { ...DEFAULT_WINDOW, ...(d.window ?? {}) },
  };
}
