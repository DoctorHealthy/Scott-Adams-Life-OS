import { DEFAULT_MEALS, type DietMeal } from "./meals";

// What a check-in stores for diet: the meals/snacks eaten (with a macro
// snapshot so history stays correct even if the catalog changes later) and
// the water drunk. All sums are computed here in code.

export type LoggedItem = {
  kind: "meal" | "snack";
  id?: string; // catalog id for menu meals; absent for ad-hoc snacks
  name: string;
  kcal: number;
  protein: number;
};

export type DietLogValue = {
  items: LoggedItem[];
  waterMl: number;
};

export const GLASS_ML = 250;

export function emptyDietLog(): DietLogValue {
  return { items: [], waterMl: 0 };
}

// Normalize whatever is stored in entries.meals into a DietLogValue.
// Handles the old format (array of meal-id strings) for backward compatibility.
export function readDietLog(raw: unknown): DietLogValue {
  if (Array.isArray(raw)) {
    const items: LoggedItem[] = [];
    for (const el of raw) {
      if (typeof el === "string") {
        const m = DEFAULT_MEALS.find((x) => x.id === el);
        if (m)
          items.push({
            kind: "meal",
            id: m.id,
            name: m.name,
            kcal: m.kcal,
            protein: m.protein,
          });
      } else if (el && typeof el === "object") {
        const o = el as Partial<LoggedItem>;
        if (typeof o.name === "string")
          items.push({
            kind: o.kind === "snack" ? "snack" : "meal",
            id: o.id,
            name: o.name,
            kcal: Number(o.kcal) || 0,
            protein: Number(o.protein) || 0,
          });
      }
    }
    return { items, waterMl: 0 };
  }
  if (raw && typeof raw === "object") {
    const o = raw as { items?: unknown; waterMl?: unknown };
    const items: LoggedItem[] = Array.isArray(o.items)
      ? (o.items as LoggedItem[]).map((i): LoggedItem => ({
          kind: i.kind === "snack" ? "snack" : "meal",
          id: i.id,
          name: String(i.name ?? ""),
          kcal: Number(i.kcal) || 0,
          protein: Number(i.protein) || 0,
        }))
      : [];
    return { items, waterMl: Number(o.waterMl) || 0 };
  }
  return emptyDietLog();
}

export function logTotals(items: LoggedItem[]): { kcal: number; protein: number } {
  let kcal = 0;
  let protein = 0;
  for (const i of items) {
    kcal += i.kcal;
    protein += i.protein;
  }
  return { kcal, protein };
}

export function mealToLogItem(m: DietMeal): LoggedItem {
  return { kind: "meal", id: m.id, name: m.name, kcal: m.kcal, protein: m.protein };
}
