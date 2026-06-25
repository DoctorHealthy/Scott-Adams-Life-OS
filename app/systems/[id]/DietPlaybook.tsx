"use client";

import { useState } from "react";
import {
  buildShoppingList,
  type DietMeal,
  type Ingredient,
  type Section,
} from "@/lib/diet/meals";
import type { Targets } from "@/lib/diet/targets";
import type {
  DietConfig,
  DietWindow,
  TargetOverride,
} from "@/lib/diet/config";
import { saveDietConfig } from "@/app/diet/actions";

type MealForm = {
  id: string | null; // null = new
  name: string;
  kcal: string;
  protein: string;
  ingredients: string;
};

const EMPTY_MEAL_FORM: MealForm = {
  id: null,
  name: "",
  kcal: "",
  protein: "",
  ingredients: "",
};

function joinIngredients(m: DietMeal): string {
  return (m.ingredients ?? []).map((i) => i.item).join(", ");
}

function parseIngredients(text: string, original?: Ingredient[]): Ingredient[] {
  const trimmed = text.trim();
  // If unchanged from the original, keep the structured (aisle-tagged) version.
  if (original && trimmed === original.map((i) => i.item).join(", ").trim()) {
    return original;
  }
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item): Ingredient => ({ item, section: "Other" as Section }));
}

function intOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function DietPlaybook({
  computed,
  config,
}: {
  computed: Targets;
  config: DietConfig;
}) {
  const [meals, setMeals] = useState<DietMeal[]>(config.meals);
  const [menu, setMenu] = useState<string[]>(config.menu);
  const [windowTimes, setWindowTimes] = useState<DietWindow>(config.window);
  const [override, setOverride] = useState<TargetOverride>(config.targets);

  const [mealForm, setMealForm] = useState<MealForm | null>(null);
  const [list, setList] = useState<
    { section: Section; items: string[] }[] | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Target edit fields (strings so the inputs can be cleared).
  const [tMaint, setTMaint] = useState<string>(
    override.maintenance != null ? String(override.maintenance) : ""
  );
  const [tLean, setTLean] = useState<string>(
    override.leanGain != null ? String(override.leanGain) : ""
  );
  const [tProt, setTProt] = useState<string>(
    override.protein != null ? String(override.protein) : ""
  );
  const [tWater, setTWater] = useState<string>(
    override.waterMl != null ? String(override.waterMl) : ""
  );

  async function persist(next: {
    meals?: DietMeal[];
    menu?: string[];
    window?: DietWindow;
    targets?: TargetOverride;
    msg?: string;
  }) {
    const cfg: DietConfig = {
      meals: next.meals ?? meals,
      menu: next.menu ?? menu,
      window: next.window ?? windowTimes,
      targets: next.targets ?? override,
    };
    if (next.meals) setMeals(next.meals);
    if (next.menu) setMenu(next.menu);
    if (next.window) setWindowTimes(next.window);
    if (next.targets) setOverride(next.targets);

    setSaving(true);
    setError(null);
    const res = await saveDietConfig(cfg);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedMsg(next.msg ?? "Saved.");
  }

  // ---- rotation ----
  function toggleRotation(id: string) {
    const next = menu.includes(id)
      ? menu.filter((x) => x !== id)
      : [...menu, id];
    persist({ menu: next, msg: "Rotation saved." });
  }

  // ---- meal CRUD ----
  function openAdd() {
    setMealForm({ ...EMPTY_MEAL_FORM });
  }
  function openEdit(m: DietMeal) {
    setMealForm({
      id: m.id,
      name: m.name,
      kcal: String(m.kcal),
      protein: String(m.protein),
      ingredients: joinIngredients(m),
    });
  }
  function saveMeal() {
    if (!mealForm) return;
    const name = mealForm.name.trim();
    if (!name) {
      setError("Meal needs a name.");
      return;
    }
    const kcal = Math.max(0, Math.round(Number(mealForm.kcal) || 0));
    const protein = Math.max(0, Math.round(Number(mealForm.protein) || 0));

    if (mealForm.id) {
      const orig = meals.find((m) => m.id === mealForm.id);
      const nextMeals = meals.map((m) =>
        m.id === mealForm.id
          ? {
              ...m,
              name,
              kcal,
              protein,
              ingredients: parseIngredients(mealForm.ingredients, orig?.ingredients),
            }
          : m
      );
      setMealForm(null);
      persist({ meals: nextMeals, msg: "Meal updated." });
    } else {
      const meal: DietMeal = {
        id: crypto.randomUUID(),
        name,
        kcal,
        protein,
        custom: true,
        ingredients: parseIngredients(mealForm.ingredients),
      };
      setMealForm(null);
      persist({ meals: [...meals, meal], msg: "Meal added." });
    }
  }
  function removeMeal(m: DietMeal) {
    if (!window.confirm(`Remove "${m.name}" from your meals?`)) return;
    persist({
      meals: meals.filter((x) => x.id !== m.id),
      menu: menu.filter((id) => id !== m.id),
      msg: "Meal removed.",
    });
  }

  // ---- window ----
  function setWindowField(k: keyof DietWindow, v: string) {
    setWindowTimes({ ...windowTimes, [k]: v });
  }

  // ---- targets ----
  function saveTargets() {
    persist({
      targets: {
        maintenance: intOrNull(tMaint),
        leanGain: intOrNull(tLean),
        protein: intOrNull(tProt),
        waterMl: intOrNull(tWater),
      },
      msg: "Targets saved.",
    });
  }
  function resetTargets() {
    setTMaint("");
    setTLean("");
    setTProt("");
    setTWater("");
    persist({
      targets: { maintenance: null, leanGain: null, protein: null, waterMl: null },
      msg: "Back to computed defaults.",
    });
  }

  function build() {
    const selected = menu
      .map((id) => meals.find((m) => m.id === id))
      .filter((m): m is DietMeal => !!m);
    setList(buildShoppingList(selected));
  }

  const rotationMeals = menu
    .map((id) => meals.find((m) => m.id === id))
    .filter((m): m is DietMeal => !!m);

  const eff = {
    maintenance: override.maintenance ?? computed.maintenance,
    leanGain: override.leanGain ?? computed.leanGain,
    protein: override.protein ?? computed.protein,
    waterMl: override.waterMl ?? computed.waterMl,
  };

  return (
    <div className="stack">
      {/* TARGETS (editable) */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Your targets</span>
          {savedMsg ? <span className="muted" style={{ fontSize: 12 }}>{savedMsg}</span> : null}
        </div>
        <div className="target-grid">
          <TargetEditor
            label="Maintenance kcal"
            computed={computed.maintenance}
            value={tMaint}
            onChange={setTMaint}
            effective={eff.maintenance}
            overridden={override.maintenance != null}
          />
          <TargetEditor
            label="Lean-gain kcal (default goal)"
            computed={computed.leanGain}
            value={tLean}
            onChange={setTLean}
            effective={eff.leanGain}
            overridden={override.leanGain != null}
            highlight
          />
          <TargetEditor
            label="Protein g / day"
            computed={computed.protein}
            value={tProt}
            onChange={setTProt}
            effective={eff.protein}
            overridden={override.protein != null}
          />
          <TargetEditor
            label="Water ml / day"
            computed={computed.waterMl}
            value={tWater}
            onChange={setTWater}
            effective={eff.waterMl}
            overridden={override.waterMl != null}
          />
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn btn-primary btn-auto" onClick={saveTargets} disabled={saving}>
            {saving ? "Saving..." : "Save targets"}
          </button>
          <button className="btn btn-auto" onClick={resetTargets} disabled={saving}>
            Use computed defaults
          </button>
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
          Leave a box blank to use the code-computed default. Computed from Mifflin-St
          Jeor and your stats. The coach reads these, it never guesses them.
        </p>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* EATING WINDOW */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Eating window (no fasting)
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Two to three real meals, 4 to 5 hours apart, front-loaded, last meal well
          before bed. As your wake time moves earlier, pull these earlier.
        </p>
        <div className="window-grid">
          <label className="window-cell">
            <span className="window-name">Meal 1 (biggest, highest protein)</span>
            <input type="time" value={windowTimes.meal1} onChange={(e) => setWindowField("meal1", e.target.value)} />
          </label>
          <label className="window-cell">
            <span className="window-name">Meal 2 (protein + complex carbs)</span>
            <input type="time" value={windowTimes.meal2} onChange={(e) => setWindowField("meal2", e.target.value)} />
          </label>
          <label className="window-cell">
            <span className="window-name">Meal 3 (lighter, before bed)</span>
            <input type="time" value={windowTimes.meal3} onChange={(e) => setWindowField("meal3", e.target.value)} />
          </label>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            className="btn btn-auto"
            onClick={() => persist({ window: windowTimes, msg: "Window saved." })}
            disabled={saving}
          >
            Save window times
          </button>
        </div>
      </div>

      {/* MEAL MENU */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Your meal menu</span>
          <button className="btn btn-ghost btn-auto" onClick={openAdd}>
            + Add meal
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Tap a meal to add it to your rotation (it builds your shopping list and
          shows first in the check-in). Edit or remove any meal, or add your own.
        </p>

        {mealForm ? (
          <div className="meal-editor">
            <div className="field">
              <label>Meal name</label>
              <input
                value={mealForm.name}
                onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
                placeholder="e.g. Protein oats"
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Calories (kcal)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mealForm.kcal}
                  onChange={(e) => setMealForm({ ...mealForm, kcal: e.target.value })}
                  placeholder="600"
                />
              </div>
              <div className="field">
                <label>Protein (g)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mealForm.protein}
                  onChange={(e) => setMealForm({ ...mealForm, protein: e.target.value })}
                  placeholder="40"
                />
              </div>
            </div>
            <div className="field">
              <label>Ingredients (comma-separated, optional)</label>
              <input
                value={mealForm.ingredients}
                onChange={(e) => setMealForm({ ...mealForm, ingredients: e.target.value })}
                placeholder="oats, yogurt, berries"
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary btn-auto" onClick={saveMeal} disabled={saving}>
                {mealForm.id ? "Save meal" : "Add meal"}
              </button>
              <button className="btn btn-auto" onClick={() => setMealForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="meal-cards">
          {meals.map((m) => {
            const inRotation = menu.includes(m.id);
            return (
              <div className={`meal-card2${inRotation ? " on" : ""}`} key={m.id}>
                <button className="meal-card2-main" onClick={() => toggleRotation(m.id)}>
                  <div className="meal-card2-top">
                    <span className="meal-card2-name">{m.name}</span>
                    {m.custom ? <span className="badge badge-soft">custom</span> : null}
                  </div>
                  <div className="meal-card2-macros">
                    <span className="macro-kcal">{m.kcal} kcal</span>
                    <span className="macro-protein">{m.protein} g protein</span>
                  </div>
                  <span className={`rotation-flag${inRotation ? " on" : ""}`}>
                    {inRotation ? "In rotation" : "Tap to add to rotation"}
                  </span>
                </button>
                <div className="meal-card2-actions">
                  <button className="btn btn-ghost btn-auto" onClick={() => openEdit(m)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-auto btn-danger"
                    onClick={() => removeMeal(m)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SHOPPING LIST */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Shopping list</span>
          <button className="btn btn-ghost btn-auto" onClick={build}>
            Build shopping list
          </button>
        </div>
        {list === null ? (
          <p className="muted" style={{ margin: 0 }}>
            Pick your rotation above, then build the list. Grouped by aisle. Hofer
            for staples, Billa for the rest.
          </p>
        ) : list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No ingredients yet. Add meals (with ingredients) to your rotation.
          </p>
        ) : (
          <div className="shop-list">
            {list.map((g) => (
              <div className="shop-group" key={g.section}>
                <div className="shop-section">{g.section}</div>
                <ul>
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PREP */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Prep notes
        </div>
        {rotationMeals.filter((m) => m.prep).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Prep notes appear here for the meals in your rotation that have them.
          </p>
        ) : (
          <div className="prep-list">
            {rotationMeals
              .filter((m) => m.prep)
              .map((m) => (
                <div className="prep-item" key={m.id}>
                  <div className="prep-name">{m.name}</div>
                  <div className="prep-body muted">{m.prep}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TargetEditor({
  label,
  computed,
  value,
  onChange,
  effective,
  overridden,
  highlight,
}: {
  label: string;
  computed: number | null;
  value: string;
  onChange: (v: string) => void;
  effective: number | null;
  overridden: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`target${highlight ? " target-default" : ""}`}>
      <input
        className="target-input"
        type="number"
        inputMode="numeric"
        value={value}
        placeholder={computed != null ? String(computed) : "--"}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="target-label">{label}</div>
      <div className="target-sub muted">
        {computed != null ? `default ${computed}` : "set your stats"}
        {overridden ? " · custom" : ""}
        {effective != null ? ` · using ${effective}` : ""}
      </div>
    </div>
  );
}
