"use client";

import { useState } from "react";
import NumberField from "@/components/NumberField";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets } from "@/lib/diet/config";
import { GLASS_ML, type DietLogValue } from "@/lib/diet/log";

// Manual calorie + protein entry is primary; meals and snacks just bump the
// numbers. All math is code.
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
  const [showMenu, setShowMenu] = useState(false);
  const [showSnack, setShowSnack] = useState(false);
  const [snackName, setSnackName] = useState("");
  const [snackKcal, setSnackKcal] = useState("");
  const [snackProtein, setSnackProtein] = useState("");

  function set(field: "kcal" | "protein" | "waterMl", v: number) {
    onChange({ ...value, [field]: Math.max(0, Math.round(v)) });
  }
  function bump(field: "kcal" | "protein" | "waterMl", delta: number) {
    set(field, value[field] + delta);
  }
  function addMeal(m: DietMeal) {
    onChange({
      ...value,
      kcal: Math.max(0, value.kcal + m.kcal),
      protein: Math.max(0, value.protein + m.protein),
    });
  }
  function addSnack() {
    const k = Math.max(0, Math.round(Number(snackKcal) || 0));
    const p = Math.max(0, Math.round(Number(snackProtein) || 0));
    if (k === 0 && p === 0) return;
    onChange({ ...value, kcal: value.kcal + k, protein: value.protein + p });
    setSnackName("");
    setSnackKcal("");
    setSnackProtein("");
    setShowSnack(false);
  }

  function gap(total: number, target: number | null, unit: string) {
    if (target == null) return "no target";
    const g = target - total;
    if (g > 0) return `${g} ${unit} under`;
    if (g < 0) return `${-g} ${unit} over`;
    return "on target";
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
      {/* Calories */}
      <div className="stepper">
        <div className="stepper-label">
          Calories
          <span className="stepper-sub muted">
            / {targets.leanGain ?? "--"} kcal &middot; {gap(value.kcal, targets.leanGain, "kcal")}
          </span>
        </div>
        <div className="stepper-controls">
          <button className="step-btn" onClick={() => bump("kcal", -100)}>
            &minus;100
          </button>
          <NumberField
            className="step-input"
            value={value.kcal}
            onValue={(n) => set("kcal", n ?? 0)}
            min={0}
            aria-label="Calories"
          />
          <button className="step-btn" onClick={() => bump("kcal", 100)}>
            +100
          </button>
        </div>
      </div>

      {/* Protein */}
      <div className="stepper">
        <div className="stepper-label">
          Protein
          <span className="stepper-sub muted">
            / {targets.protein ?? "--"} g &middot; {gap(value.protein, targets.protein, "g")}
          </span>
        </div>
        <div className="stepper-controls">
          <button className="step-btn" onClick={() => bump("protein", -10)}>
            &minus;10
          </button>
          <NumberField
            className="step-input"
            value={value.protein}
            onValue={(n) => set("protein", n ?? 0)}
            min={0}
            aria-label="Protein grams"
          />
          <button className="step-btn" onClick={() => bump("protein", 10)}>
            +10
          </button>
        </div>
      </div>

      {/* Water */}
      <div className="water-block" style={{ marginTop: 14 }}>
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
            <button className="water-btn" onClick={() => bump("waterMl", GLASS_ML)}>
              + glass
            </button>
            <button className="water-btn" onClick={() => bump("waterMl", 500)}>
              + 500 ml
            </button>
            <button
              className="water-btn"
              onClick={() => bump("waterMl", -GLASS_ML)}
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

      {/* Weight: a measurement, optional, never carried over from yesterday. */}
      <div className="weight-row" style={{ marginTop: 14 }}>
        <span className="stepper-label">
          Weight
          <span className="stepper-sub muted">kg, optional, when you weigh in</span>
        </span>
        <NumberField
          className="step-input"
          value={value.weightKg}
          onValue={(n) =>
            onChange({
              ...value,
              weightKg: n != null && n > 0 ? Math.round(n * 10) / 10 : null,
            })
          }
          allowEmpty
          allowDecimal
          min={0}
          placeholder="--"
          aria-label="Weight in kilograms"
        />
      </div>

      {/* Optional: add from the meal menu */}
      <div style={{ marginTop: 14 }}>
        <button className="link-btn" onClick={() => setShowMenu((s) => !s)}>
          {showMenu ? "Hide meal menu" : "Add from meal menu"}
        </button>
        {showMenu ? (
          catalog.length === 0 ? (
            <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              No meals in your menu. Add some in the Diet playbook.
            </p>
          ) : (
            <div className="meal-log-list" style={{ marginTop: 10 }}>
              {catalog.map((m) => (
                <button
                  key={m.id}
                  className="meal-log-row"
                  onClick={() => addMeal(m)}
                >
                  <span className="meal-log-check">+</span>
                  <span className="meal-log-name">{m.name}</span>
                  <span className="meal-log-macros">
                    {m.kcal} kcal &middot; {m.protein} g
                  </span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>

      {/* Snack quick-add */}
      <div style={{ marginTop: 10 }}>
        {showSnack ? (
          <div className="snack-form">
            <input
              placeholder="Snack name (optional)"
              value={snackName}
              onChange={(e) => setSnackName(e.target.value)}
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
              <button className="btn btn-primary btn-auto" onClick={addSnack}>
                Add
              </button>
              <button className="btn btn-auto" onClick={() => setShowSnack(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="link-btn" onClick={() => setShowSnack(true)}>
            + Quick-add a snack
          </button>
        )}
      </div>
    </div>
  );
}
