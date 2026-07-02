"use client";

import { useState } from "react";
import TrendChart from "@/components/TrendChart";
import { minToHHMM } from "@/lib/sleep/sleep";
import type { TrendSeries, Point } from "@/lib/trends/trends";

function tail(points: Point[], days: number): Point[] {
  return points.slice(-days);
}

export default function TrendsView({ series }: { series: TrendSeries }) {
  const [days, setDays] = useState<30 | 90>(30);
  const s = series;

  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 8 }}>
        {([30, 90] as const).map((d) => (
          <button
            key={d}
            className={`btn btn-auto${days === d ? " btn-primary" : ""}`}
            onClick={() => setDays(d)}
          >
            {d} days
          </button>
        ))}
      </div>

      <TrendChart
        title="Energy"
        points={tail(s.energy, days)}
        unit="/ 10"
        yMinHint={1}
        yMaxHint={10}
      />

      <TrendChart
        title="Wake time"
        points={tail(s.wakeMin, days)}
        target={s.wakeTargetMin}
        targetLabel={`target ${minToHHMM(s.wakeTargetMin)}`}
        formatValue={(v) => minToHHMM(v)}
        summary={
          s.sleepConsistencyPct != null
            ? `Wake consistency: ${s.sleepConsistencyPct}% of logged wakes within 30 min of target.`
            : undefined
        }
      />

      <TrendChart
        title="System adherence"
        points={tail(s.adherencePct, days)}
        unit="%"
        yMinHint={0}
        yMaxHint={100}
      />

      <TrendChart
        title="Protein"
        points={tail(s.protein, days)}
        unit="g"
        target={s.proteinTarget}
        targetLabel={
          s.proteinTarget != null ? `target ${s.proteinTarget} g` : undefined
        }
      />

      <TrendChart
        title="Weight"
        points={tail(s.weight, days)}
        unit="kg"
        summary="Log it in the Diet row when you weigh in."
      />
    </div>
  );
}
