// The meal catalog. The defaults below seed a user's catalog; after that the
// catalog is user data (add / edit / remove), stored in coaching_prefs.diet.
// Macros are numbers; all totals are summed in code, never by the AI.

export type Section =
  | "Protein"
  | "Carbs"
  | "Veg & fruit"
  | "Fats & extras"
  | "Other";

export type Ingredient = { item: string; section: Section };

export type DietMeal = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  blurb?: string;
  prep?: string;
  ingredients: Ingredient[];
  custom?: boolean;
};

export const SECTIONS: Section[] = [
  "Protein",
  "Carbs",
  "Veg & fruit",
  "Fats & extras",
  "Other",
];

// Neutral starter catalog seeded for a new user. After seeding, the catalog is
// user data (add / edit / remove), stored in coaching_prefs.diet.
export const DEFAULT_MEALS: DietMeal[] = [
  {
    id: "chicken-rice-veg",
    name: "Chicken, rice, vegetables",
    kcal: 650,
    protein: 45,
    ingredients: [
      { item: "Chicken breast", section: "Protein" },
      { item: "Rice", section: "Carbs" },
      { item: "Mixed vegetables", section: "Veg & fruit" },
      { item: "Olive oil", section: "Fats & extras" },
    ],
  },
  {
    id: "omelette-bread",
    name: "Omelette with bread",
    kcal: 500,
    protein: 28,
    ingredients: [
      { item: "Eggs", section: "Protein" },
      { item: "Bread", section: "Carbs" },
      { item: "Butter", section: "Fats & extras" },
    ],
  },
  {
    id: "yogurt-fruit-nuts",
    name: "Yogurt with fruit and nuts",
    kcal: 400,
    protein: 25,
    ingredients: [
      { item: "Yogurt", section: "Protein" },
      { item: "Fruit", section: "Veg & fruit" },
      { item: "Nuts", section: "Fats & extras" },
    ],
  },
  {
    id: "fish-potatoes-salad",
    name: "Fish with potatoes and salad",
    kcal: 600,
    protein: 40,
    ingredients: [
      { item: "White fish", section: "Protein" },
      { item: "Potatoes", section: "Carbs" },
      { item: "Salad mix", section: "Veg & fruit" },
      { item: "Olive oil", section: "Fats & extras" },
    ],
  },
  {
    id: "protein-shake",
    name: "Protein shake",
    kcal: 250,
    protein: 30,
    ingredients: [
      { item: "Protein powder", section: "Protein" },
      { item: "Milk", section: "Other" },
    ],
  },
];

// The original personal catalog, kept verbatim in legacy-meals.json so legacy
// check-ins that stored meal ids still resolve their kcal/protein (see
// lib/diet/log.ts sumItems). The JSON is shared with scripts/preserve-personal-content.mjs.
import legacyMeals from "./legacy-meals.json";
export const LEGACY_MEALS: DietMeal[] = legacyMeals as DietMeal[];

export function mealById(meals: DietMeal[], id: string): DietMeal | undefined {
  return meals.find((m) => m.id === id);
}

// Shopping list from a set of meals, grouped by aisle, deduped, sorted.
export function buildShoppingList(
  meals: DietMeal[]
): { section: Section; items: string[] }[] {
  const map = new Map<Section, Set<string>>();
  for (const s of SECTIONS) map.set(s, new Set());
  for (const m of meals) {
    for (const ing of m.ingredients ?? []) {
      map.get(ing.section)?.add(ing.item);
    }
  }
  return SECTIONS.map((section) => ({
    section,
    items: Array.from(map.get(section) ?? []).sort(),
  })).filter((g) => g.items.length > 0);
}
