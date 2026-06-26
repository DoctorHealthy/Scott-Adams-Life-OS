import { DEFAULT_MEALS } from "./meals";

// What a check-in stores for diet. Primary inputs are running calorie and
// protein numbers the user bumps directly; meals and snacks just add to them.
// All sums are computed in code; the coach only reads them.

export type DietLogValue = {
  kcal: number;
  protein: number;
  waterMl: number;
};

export const GLASS_ML = 250;

export function emptyDietLog(): DietLogValue {
  return { kcal: 0, protein: 0, waterMl: 0 };
}

function sumItems(items: unknown[]): { kcal: number; protein: number } {
  let kcal = 0;
  let protein = 0;
  for (const el of items) {
    if (typeof el === "string") {
      const m = DEFAULT_MEALS.find((x) => x.id === el);
      if (m) {
        kcal += m.kcal;
        protein += m.protein;
      }
    } else if (el && typeof el === "object") {
      const o = el as { kcal?: unknown; protein?: unknown };
      kcal += Number(o.kcal) || 0;
      protein += Number(o.protein) || 0;
    }
  }
  return { kcal, protein };
}

// Normalize whatever is stored in entries.meals. Handles the new shape plus the
// two older shapes (an object with items, and the oldest array of meal ids).
export function readDietLog(raw: unknown): DietLogValue {
  if (Array.isArray(raw)) {
    const t = sumItems(raw);
    return { kcal: t.kcal, protein: t.protein, waterMl: 0 };
  }
  if (raw && typeof raw === "object") {
    const o = raw as {
      kcal?: unknown;
      protein?: unknown;
      waterMl?: unknown;
      items?: unknown;
    };
    if (typeof o.kcal === "number" || typeof o.protein === "number") {
      return {
        kcal: Number(o.kcal) || 0,
        protein: Number(o.protein) || 0,
        waterMl: Number(o.waterMl) || 0,
      };
    }
    if (Array.isArray(o.items)) {
      const t = sumItems(o.items);
      return { kcal: t.kcal, protein: t.protein, waterMl: Number(o.waterMl) || 0 };
    }
  }
  return emptyDietLog();
}
