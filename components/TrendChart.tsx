"use client";

// One small, calm line chart with real axes. Pure SVG, no library. Critical
// visuals (stroke, fill, layout) are inline so they never depend on stylesheet
// load order. Null values are gaps; isolated points render as dots; one
// optional target line. The y-axis viewBox height equals the pixel height, so
// the HTML y-tick labels align 1:1 with the SVG gridlines.

import type { Point } from "@/lib/trends/trends";

// Design tokens, inlined so the chart always renders correctly.
const ACCENT = "#f5a524";
const MUTED = "#8b8b92";
const BORDER = "#2a2a2e";
const PANEL = "#151517";
const GRID = "#232327";

const W = 640; // viewBox width (x stretches to the container)
const H = 150; // viewBox height AND css pixel height, so y is 1:1
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 10;
const PAD_B = 10;

const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function shortDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${MON[m - 1]} ${day}`;
}

// Round bounds to human numbers, aiming for ~2 intervals (3 tick labels).
function niceNum(x: number, round: boolean): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nf: number;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
function niceBounds(lo: number, hi: number): { min: number; max: number } {
  if (!(hi > lo)) {
    return { min: Math.floor(lo) - 1, max: Math.ceil(lo) + 1 };
  }
  const step = niceNum(niceNum(hi - lo, false) / 2, true);
  return {
    min: Math.floor(lo / step) * step,
    max: Math.ceil(hi / step) * step,
  };
}

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
  const isTime = !!formatValue; // time charts pass a HH:MM formatter
  const fmt = formatValue ?? ((v: number) => String(Math.round(v * 10) / 10));
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const gid = "grad-" + title.replace(/[^a-zA-Z0-9]/g, "");

  const cardStyle: React.CSSProperties = {
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: "14px 16px",
  };
  const headStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  };

  if (vals.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={headStyle}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>
          No data in this window yet. Log it and the line appears.
        </p>
      </div>
    );
  }

  const dataLo = Math.min(...vals);
  const dataHi = Math.max(...vals);

  // ----- decide the y-scale by chart type -----
  const isPercent = yMinHint === 0 && yMaxHint === 100;
  const isEnergy = yMinHint === 1 && yMaxHint === 10;
  let lo: number;
  let hi: number;
  if (isTime && yMinHint != null && yMaxHint != null) {
    lo = yMinHint;
    hi = yMaxHint;
  } else if (isPercent) {
    lo = 0;
    hi = 100;
  } else if (isEnergy) {
    lo = 0;
    hi = 10;
  } else {
    const rlo = Math.min(dataLo, ...(target != null ? [target] : []));
    const rhi = Math.max(dataHi, ...(target != null ? [target] : []));
    const nb = niceBounds(rlo, rhi);
    lo = nb.min;
    hi = nb.max;
  }
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }

  const n = points.length;
  const x = (i: number) =>
    PAD_L + (n <= 1 ? (W - PAD_L - PAD_R) / 2 : (i / (n - 1)) * (W - PAD_L - PAD_R));
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const baseY = H - PAD_B;
  const midV = (lo + hi) / 2;
  const gridYs = [PAD_T, (PAD_T + baseY) / 2, baseY];

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
  const lastPt = last?.value != null ? points.lastIndexOf(last) : -1;

  const midIdx = Math.floor((n - 1) / 2);
  const yLabelStyle: React.CSSProperties = {
    position: "absolute",
    right: 6,
    fontSize: 10,
    color: MUTED,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  };

  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <span style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
          {lastLabel}
          {unit ? <span style={{ color: MUTED }}> {unit}</span> : null}
        </span>
      </div>
      {summary ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{summary}</p>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {/* y-axis tick labels, aligned to the gridlines */}
        <div style={{ position: "relative", width: 40, height: H, flexShrink: 0 }}>
          <span style={{ ...yLabelStyle, top: PAD_T - 5 }}>{fmt(hi)}</span>
          <span style={{ ...yLabelStyle, top: H / 2 - 5 }}>{fmt(midV)}</span>
          <span style={{ ...yLabelStyle, top: baseY - 5 }}>{fmt(lo)}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={title}
            style={{ display: "block", width: "100%", height: H }}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridYs.map((gy, i) => (
              <line
                key={i}
                x1={PAD_L}
                x2={W - PAD_R}
                y1={gy}
                y2={gy}
                stroke={GRID}
                strokeWidth={1}
              />
            ))}

            {target != null && target >= lo && target <= hi ? (
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(target)}
                y2={y(target)}
                stroke={MUTED}
                strokeWidth={1}
                strokeDasharray="5 5"
                opacity={0.8}
              />
            ) : null}

            {runs.map((run, ri) => {
              if (run.length === 1) {
                return (
                  <circle
                    key={ri}
                    cx={x(run[0].i)}
                    cy={y(run[0].v)}
                    r={3.5}
                    fill={ACCENT}
                  />
                );
              }
              const line = run.map((p) => `${x(p.i)},${y(p.v)}`).join(" ");
              const area =
                `M ${x(run[0].i)},${baseY} ` +
                run.map((p) => `L ${x(p.i)},${y(p.v)}`).join(" ") +
                ` L ${x(run[run.length - 1].i)},${baseY} Z`;
              return (
                <g key={ri}>
                  <path d={area} fill={`url(#${gid})`} stroke="none" />
                  <polyline
                    points={line}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {lastPt >= 0 && last?.value != null ? (
              <circle cx={x(lastPt)} cy={y(last.value)} r={3.5} fill={ACCENT} />
            ) : null}
          </svg>

          {/* x-axis date labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 10,
              color: MUTED,
              marginTop: 4,
            }}
          >
            <span>{shortDate(points[0].date)}</span>
            {n > 2 ? <span>{shortDate(points[midIdx].date)}</span> : null}
            <span>{shortDate(points[n - 1].date)}</span>
          </div>
          {target != null && targetLabel ? (
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
              {targetLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
