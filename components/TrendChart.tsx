"use client";

// One small, calm line chart. Pure SVG, no library. Null values are gaps;
// isolated points render as dots. A single optional target line.

import type { Point } from "@/lib/trends/trends";

const W = 640;
const H = 150;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 10;

export default function TrendChart({
  title,
  points,
  unit,
  target,
  targetLabel,
  yMinHint,
  yMaxHint,
  formatValue,
  summary,
}: {
  title: string;
  points: Point[];
  unit?: string;
  target?: number | null;
  targetLabel?: string;
  yMinHint?: number;
  yMaxHint?: number;
  formatValue?: (v: number) => string;
  summary?: string;
}) {
  const fmt = formatValue ?? ((v: number) => String(Math.round(v * 10) / 10));
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);

  if (vals.length === 0) {
    return (
      <div className="trend-card">
        <div className="trend-head">
          <span className="trend-title">{title}</span>
        </div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
          No data in this window yet. Log it and the line appears.
        </p>
      </div>
    );
  }

  let lo = Math.min(...vals, ...(target != null ? [target] : []));
  let hi = Math.max(...vals, ...(target != null ? [target] : []));
  if (yMinHint != null) lo = Math.min(lo, yMinHint);
  if (yMaxHint != null) hi = Math.max(hi, yMaxHint);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  // A little headroom so the line never kisses the frame.
  const span = hi - lo;
  lo -= span * 0.08;
  hi += span * 0.08;

  const n = points.length;
  const x = (i: number) =>
    PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD_L - PAD_R));
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  // Split into contiguous runs so nulls become gaps.
  const runs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push({ i, v: p.value });
    }
  });
  if (cur.length) runs.push(cur);

  const last = [...points].reverse().find((p) => p.value != null);
  const lastLabel = last?.value != null ? fmt(last.value) : "";

  return (
    <div className="trend-card">
      <div className="trend-head">
        <span className="trend-title">{title}</span>
        <span className="trend-latest">
          {lastLabel}
          {unit ? <span className="muted"> {unit}</span> : null}
        </span>
      </div>
      {summary ? <p className="trend-summary muted">{summary}</p> : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-svg"
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
      >
        {target != null ? (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(target)}
            y2={y(target)}
            className="trend-target"
          />
        ) : null}
        {runs.map((run, ri) =>
          run.length === 1 ? (
            <circle
              key={ri}
              cx={x(run[0].i)}
              cy={y(run[0].v)}
              r={3}
              className="trend-dot"
            />
          ) : (
            <polyline
              key={ri}
              points={run.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
              className="trend-line"
            />
          )
        )}
      </svg>
      <div className="trend-axis">
        <span className="muted">{fmt(Math.round((lo + span * 0.08) * 10) / 10)}</span>
        {target != null && targetLabel ? (
          <span className="muted">{targetLabel}</span>
        ) : null}
        <span className="muted">{fmt(Math.round((hi - span * 0.08) * 10) / 10)}</span>
      </div>
    </div>
  );
}
