"use client";

import type { DayPlan } from "@/lib/today/plan";

// Pure display of the code-assembled plan. No AI, exact numbers.
export default function PlanCard({ plan }: { plan: DayPlan }) {
  return (
    <div className="plan">
      <div className="plan-row">
        <span className="plan-k">Sleep</span>
        <span>
          Wake {plan.sleep.wake} &middot; bed {plan.sleep.bed}
          {plan.sleep.atGoal ? " (at goal)" : ""}
        </span>
      </div>
      <div className="plan-row">
        <span className="plan-k">Training</span>
        <span>{plan.session}</span>
      </div>
      <div className="plan-row">
        <span className="plan-k">Targets</span>
        <span>
          {plan.targets.kcal ?? "--"} kcal &middot; {plan.targets.protein ?? "--"} g
          protein &middot; {plan.targets.waterMl ?? "--"} ml water
        </span>
      </div>

      {plan.morningBlock.length > 0 ? (
        <div className="plan-block">
          <div className="plan-k">Morning block</div>
          <ul className="plan-list">
            {plan.morningBlock.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.meals.length > 0 ? (
        <div className="plan-block">
          <div className="plan-k">Planned meals</div>
          <ul className="plan-list">
            {plan.meals.map((m, i) => (
              <li key={i}>
                {m.name}{" "}
                <span className="muted">
                  ({m.kcal} kcal, {m.protein} g)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <blockquote className="gem gem-compact" style={{ marginTop: 14 }}>
        <p className="gem-text">{plan.gem.text}</p>
        <footer className="gem-source">
          {plan.gem.source}
          {plan.gem.note ? <span className="gem-note"> ({plan.gem.note})</span> : null}
        </footer>
      </blockquote>
    </div>
  );
}
