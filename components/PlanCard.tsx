"use client";

import type { DayPlan } from "@/lib/today/plan";

// Pure display of the code-assembled plan, as clean labeled cards. No AI.
export default function PlanCard({ plan }: { plan: DayPlan }) {
  return (
    <div className="plan">
      <div className="plan-cards">
        <div className="plan-card">
          <div className="plan-card-k">Sleep</div>
          <div className="plan-card-v">
            wake {plan.sleep.wake} &middot; bed {plan.sleep.bed}
            {plan.sleep.atGoal ? " (at goal)" : ""}
          </div>
        </div>
        <div className="plan-card">
          <div className="plan-card-k">Training</div>
          <div className="plan-card-v">{plan.session}</div>
        </div>
        <div className="plan-card">
          <div className="plan-card-k">Targets</div>
          <div className="plan-card-v">
            {plan.targets.kcal ?? "--"} kcal &middot; {plan.targets.protein ?? "--"} g
            protein &middot; {plan.targets.waterMl ?? "--"} ml water
          </div>
        </div>
      </div>

      {plan.morningBlock.length > 0 ? (
        <div className="plan-list-card">
          <div className="plan-card-k">Morning block</div>
          <ul className="plan-ul">
            {plan.morningBlock.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.meals.length > 0 ? (
        <div className="plan-list-card">
          <div className="plan-card-k">Planned meals</div>
          <div className="plan-meals">
            {plan.meals.map((m, i) => (
              <div className="plan-meal-row" key={i}>
                <span className="plan-meal-name">{m.name}</span>
                <span className="plan-meal-macros">
                  {m.kcal} kcal &middot; {m.protein} g
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="plan-list-card">
        <div className="plan-card-k">Gem of the day</div>
        <blockquote className="gem gem-compact" style={{ marginTop: 8 }}>
          <p className="gem-text">{plan.gem.text}</p>
          <footer className="gem-source">
            {plan.gem.source}
            {plan.gem.note ? <span className="gem-note"> ({plan.gem.note})</span> : null}
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
