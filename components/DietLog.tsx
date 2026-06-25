"use client";

import { useState } from "react";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets } from "@/lib/diet/config";
import {
  GLASS_ML,
  logTotals,
  mealToLogItem,
  type DietLogValue,
  type LoggedItem,
} from "@/lib/diet/log";

// All calorie / protein / water math here is plain code. The coach only reads it.
export default function DietLog({
  catalog,
  targets,
  value,
  onChange,
}: {
  catalog: DietMeal[];
  targets: EffectiveTargets;
  value: DietLogValue;
  onChange: (v: DietLogValue) => void;
}) {
  const [snackName, setSnackName] = useState("");
  const [snackKcal, setSnackKcal] = useState("");
  const [snackProtein, setSnackProtein] = useState("");
  const [showSnack, setShowSnack] = useState(false);

  const totals = logTotals(value.items);
  const eatenIds = new Set(value.items.filter((i) => i.id).map((i) => i.id));
  const snacks = value.items.filter((i) => i.kind === "snack");

  function gapText(total: number, target: number | null, unit: string) {
    if (target == null) return "no target set";
    const gap = target - total;
    if (gap > 0) return `${gap} ${unit} under`;
    if (gap < 0) return `${-gap} ${unit} over`;
    return "on target";
  }

  function toggleMeal(m: DietMeal) {
    const has = value.items.some((i) => i.kind === "meal" && i.id === m.id);
    const items = has
      ? value.items.filter((i) => !(i.kind === "meal" && i.id === m.id))
      : [...value.items, mealToLogItem(m)];
    onChange({ ...value, items });
  }

  function addWater(ml: number) {
    onChange({ ...value, waterMl: Math.max(0, value.waterMl + ml) });
  }

  function addSnack() {
    const name = snackName.trim();
    const kcal = Math.max(0, Math.round(Number(snackKcal) || 0));
    const protein = Math.max(0, Math.round(Number(snackProtein) || 0));
    if (!name) return;
    const item: LoggedItem = {
      kind: "snack",
      id: crypto.randomUUID(),
      name,
      kcal,
      protein,
    };
    onChange({ ...value, items: [...value.items, item] });
    setSnackName("");
    setSnackKcal("");
    setSnackProtein("");
    setShowSnack(false);
  }

  function removeItem(id: string | undefined) {
    if (!id) return;
    onChange({ ...value, items: value.items.filter((i) => i.id !== id) });
  }

  const waterTarget = targets.waterMl;
  const waterPct =
    waterTarget && waterTarget > 0
      ? Math.min(100, Math.round((value.waterMl / waterTarget) * 100))
      : 0;
  const glasses = Math.round(value.waterMl / GLASS_ML);
  const targetGlasses = waterTarget ? Math.round(waterTarget / GLASS_ML) : null;

  return (
    <div>
      {/* TOTALS */}
      <div className="diet-totals">
        <div className="diet-total">
          <span className="diet-total-num">
            {totals.kcal}
            <span className="diet-total-target"> / {targets.leanGain ?? "--"}</span>
          </span>
          <span className="diet-total-label">
            kcal &middot; {gapText(totals.kcal, targets.leanGain, "kcal")}
          </span>
        </div>
        <div className="diet-total">
          <span className="diet-total-num">
            {totals.protein}
            <span className="diet-total-target"> / {targets.protein ?? "--"}</span>
          </span>
          <span className="diet-total-label">
            g protein &middot; {gapText(totals.protein, targets.protein, "g")}
          </span>
        </div>
      </div>

      {/* WATER */}
      <div className="water-block">
        <div className="water-head">
          <span className="water-label">
            Water {value.waterMl} ml
            <span className="muted">
              {" / "}
              {waterTarget ?? "--"} ml
              {targetGlasses ? ` (${glasses}/${targetGlasses} glasses)` : ""}
            </span>
          </span>
          <div className="water-btns">
            <button className="water-btn" onClick={() => addWater(GLASS_ML)}>
              + glass
            </button>
            <button className="water-btn" onClick={() => addWater(500)}>
              + 500 ml
            </button>
            <button
              className="water-btn"
              onClick={() => addWater(-GLASS_ML)}
              disabled={value.waterMl <= 0}
            >
              &minus; glass
            </button>
          </div>
        </div>
        <div className="water-bar">
          <div className="water-fill" style={{ width: `${waterPct}%` }} />
        </div>
      </div>

      <div className="diet-divider" />

      {/* MEALS TO LOG */}
      <div className="diet-sub-label">Meals</div>
      {catalog.length === 0 ? (
        <p className="muted" style={{ margin: "0 0 12px" }}>
          No meals in your menu yet. Add some in the Diet playbook.
        </p>
      ) : (
        <div className="meal-log-list">
          {catalog.map((m) => {
            const on = eatenIds.has(m.id);
            return (
              <button
                key={m.id}
                className={`meal-log-row${on ? " on" : ""}`}
                onClick={() => toggleMeal(m)}
              >
                <span className="meal-log-check">{on ? "✓" : "+"}</span>
                <span className="meal-log-name">{m.name}</span>
                <span className="meal-log-macros">
                  {m.kcal} kcal &middot; {m.protein} g
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* SNACKS */}
      <div className="diet-sub-label" style={{ marginTop: 18 }}>
        Snacks and small meals
      </div>
      {snacks.length > 0 ? (
        <div className="snack-list">
          {snacks.map((s) => (
            <div className="snack-row" key={s.id}>
              <span className="snack-name">{s.name}</span>
              <span className="meal-log-macros">
                {s.kcal} kcal &middot; {s.protein} g
              </span>
              <button
                className="snack-remove"
                onClick={() => removeItem(s.id)}
                aria-label="Remove snack"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showSnack ? (
        <div className="snack-form">
          <input
            placeholder="Name (e.g. protein shake)"
            value={snackName}
            onChange={(e) => setSnackName(e.target.value)}
            autoFocus
          />
          <div className="snack-form-nums">
            <input
              type="number"
              inputMode="numeric"
              placeholder="kcal"
              value={snackKcal}
              onChange={(e) => setSnackKcal(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="protein g"
              value={snackProtein}
              onChange={(e) => setSnackProtein(e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button
              className="btn btn-primary btn-auto"
              onClick={addSnack}
              disabled={!snackName.trim()}
            >
              Add
            </button>
            <button className="btn btn-auto" onClick={() => setShowSnack(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setShowSnack(true)}
        >
          + Add snack or small meal
        </button>
      )}
    </div>
  );
}
