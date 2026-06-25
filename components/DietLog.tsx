"use client";

import { MEALS, mealById, mealTotals } from "@/lib/diet/meals";
import type { Targets } from "@/lib/diet/targets";

// All calorie/protein math here is plain code. The coach only reads the result.
export default function DietLog({
  menuIds,
  value,
  onChange,
  targets,
}: {
  menuIds: string[];
  value: string[];
  onChange: (ids: string[]) => void;
  targets: Targets;
}) {
  // Show the user's chosen menu if set, otherwise the full default menu.
  const shown =
    menuIds.length > 0
      ? menuIds.map((id) => mealById(id)).filter(Boolean)
      : MEALS;

  const eaten = new Set(value);
  const totals = mealTotals(value);

  const kcalTarget = targets.leanGain;
  const proteinTarget = targets.protein;

  function toggle(id: string) {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  function gapText(total: number, target: number | null, unit: string) {
    if (target == null) return "target not set";
    const gap = target - total;
    if (gap > 0) return `${gap} ${unit} under`;
    if (gap < 0) return `${-gap} ${unit} over`;
    return "on target";
  }

  return (
    <div>
      <div className="diet-totals">
        <div className="diet-total">
          <span className="diet-total-num">
            {totals.kcal}
            <span className="diet-total-target">
              {" / "}
              {kcalTarget ?? "--"}
            </span>
          </span>
          <span className="diet-total-label">
            kcal &middot; {gapText(totals.kcal, kcalTarget, "kcal")}
          </span>
        </div>
        <div className="diet-total">
          <span className="diet-total-num">
            {totals.protein}
            <span className="diet-total-target">
              {" / "}
              {proteinTarget ?? "--"}
            </span>
          </span>
          <span className="diet-total-label">
            g protein &middot; {gapText(totals.protein, proteinTarget, "g")}
          </span>
        </div>
      </div>

      <div className="meal-log-list">
        {shown.map((m) =>
          m ? (
            <button
              key={m.id}
              className={`meal-log-row${eaten.has(m.id) ? " on" : ""}`}
              onClick={() => toggle(m.id)}
            >
              <span className="meal-log-check">{eaten.has(m.id) ? "✓" : "+"}</span>
              <span className="meal-log-name">{m.name}</span>
              <span className="meal-log-macros">
                {m.kcal} kcal &middot; {m.protein} g
              </span>
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}
