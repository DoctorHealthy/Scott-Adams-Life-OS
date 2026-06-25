"use client";

import { useState } from "react";
import { MEALS, buildShoppingList, mealById, type Section } from "@/lib/diet/meals";
import type { Targets } from "@/lib/diet/targets";
import type { DietConfig, DietWindow } from "@/lib/diet/config";
import { saveDietConfig } from "@/app/diet/actions";

export default function DietPlaybook({
  targets,
  config,
}: {
  targets: Targets;
  config: DietConfig;
}) {
  const [menu, setMenu] = useState<Set<string>>(new Set(config.menu));
  const [windowTimes, setWindowTimes] = useState<DietWindow>(config.window);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<{ section: Section; items: string[] }[] | null>(
    null
  );

  function toggleMeal(id: string) {
    setMenu((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSavedMsg(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveDietConfig({
      menu: Array.from(menu),
      window: windowTimes,
    });
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedMsg("Saved. This is your rotation and window now.");
  }

  function build() {
    setList(buildShoppingList(Array.from(menu)));
  }

  const menuIds = Array.from(menu);
  const selectedMeals = menuIds.map((id) => mealById(id)).filter(Boolean);

  return (
    <div className="stack">
      {/* Targets */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Your targets (computed in code from your stats)
        </div>
        {targets.ok ? (
          <div className="target-grid">
            <div className="target">
              <div className="target-num">{targets.maintenance}</div>
              <div className="target-label">Maintenance kcal</div>
            </div>
            <div className="target target-default">
              <div className="target-num">{targets.leanGain}</div>
              <div className="target-label">Lean-gain kcal (your default)</div>
            </div>
            <div className="target">
              <div className="target-num">{targets.protein}</div>
              <div className="target-label">Protein g / day</div>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Can&apos;t compute targets yet. Missing: {targets.missing.join(", ")}.
            Set these on your profile.
          </p>
        )}
        {targets.ok ? (
          <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}>
            Activity: {targets.activityLabel}. BMR {targets.bmr} kcal. Keep added
            sugar low, fats fill the rest. The coach reads these, never guesses
            them.
          </p>
        ) : null}
      </div>

      {/* Eating window */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Eating window (no fasting)
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Two to three real meals, 4 to 5 hours apart, front-loaded, last meal
          well before bed. As your wake time moves earlier, pull these earlier.
        </p>
        <div className="window-grid">
          <label className="window-cell">
            <span className="window-name">Meal 1 (biggest, highest protein)</span>
            <input
              type="time"
              value={windowTimes.meal1}
              onChange={(e) => {
                setWindowTimes({ ...windowTimes, meal1: e.target.value });
                setSavedMsg(null);
              }}
            />
          </label>
          <label className="window-cell">
            <span className="window-name">Meal 2 (protein + complex carbs)</span>
            <input
              type="time"
              value={windowTimes.meal2}
              onChange={(e) => {
                setWindowTimes({ ...windowTimes, meal2: e.target.value });
                setSavedMsg(null);
              }}
            />
          </label>
          <label className="window-cell">
            <span className="window-name">Meal 3 (lighter, before bed)</span>
            <input
              type="time"
              value={windowTimes.meal3}
              onChange={(e) => {
                setWindowTimes({ ...windowTimes, meal3: e.target.value });
                setSavedMsg(null);
              }}
            />
          </label>
        </div>
      </div>

      {/* Meal menu */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Your meal menu
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Pick 5 or 6 to rotate. Selected meals build your shopping list and show
          first in the check-in. All lactose-free, low sugar, air-fryer fast.
        </p>
        <div className="meal-menu">
          {MEALS.map((m) => {
            const on = menu.has(m.id);
            return (
              <button
                key={m.id}
                className={`meal-card${on ? " on" : ""}`}
                onClick={() => toggleMeal(m.id)}
              >
                <div className="meal-card-top">
                  <span className="meal-card-check">{on ? "In rotation" : "Add"}</span>
                  <span className="meal-card-macros">
                    {m.kcal} kcal &middot; {m.protein} g
                  </span>
                </div>
                <div className="meal-card-name">{m.name}</div>
                <div className="meal-card-blurb">{m.blurb}</div>
              </button>
            );
          })}
        </div>

        <div className="save-bar" style={{ position: "static", borderTop: "none", paddingBottom: 0 }}>
          <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save my menu and window"}
          </button>
          {savedMsg ? <span className="save-status muted">{savedMsg}</span> : null}
        </div>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* Shopping list */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Shopping list</span>
          <button className="btn btn-ghost btn-auto" onClick={build}>
            Build shopping list
          </button>
        </div>
        {list === null ? (
          <p className="muted" style={{ margin: 0 }}>
            Pick your meals above, then build the list. Grouped by aisle for a
            fast in-and-out. Hofer for staples, Billa for the rest.
          </p>
        ) : list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No meals selected yet. Add a few to your rotation first.
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

      {/* Prep */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Prep notes
        </div>
        {selectedMeals.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Prep notes appear here for the meals you add to your rotation.
          </p>
        ) : (
          <div className="prep-list">
            {selectedMeals.map((m) =>
              m ? (
                <div className="prep-item" key={m.id}>
                  <div className="prep-name">{m.name}</div>
                  <div className="prep-body muted">{m.prep}</div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
