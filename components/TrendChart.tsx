"use client";

// One small, calm line chart. Pure SVG, no library. Critical visuals (stroke,
// fill, layout) are set inline so they never depend on stylesheet load order.
// Null values are gaps; isolated points render as dots; one optional target line.

import type { Point } from "@/lib/trends/trends";

// Design tokens, inlined so the chart always renders correctly.
const ACCENT = "#f5a524";
const MUTED = "#8b8b92";
const BORDER = "#2a2a2e";
const PANEL = "#151517";
const GRID = "#232327";

const W = 640;
const H = 160;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 12;
const PAD_B = 12;

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

  let lo = Math.min(dataLo, ...(target != null ? [target] : []));
  let hi = Math.max(dataHi, ...(target != null ? [target] : []));
  if (yMinHint != null) lo = Math.min(lo, yMinHint);
  if (yMaxHint != null) hi = Math.max(hi, yMaxHint);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.12;
  hi += span * 0.12;

  const n = points.length;
  const x = (i: number) =>
    PAD_L + (n <= 1 ? (W - PAD_L - PAD_R) / 2 : (i / (n - 1)) * (W - PAD_L - PAD_R));
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const baseY = H - PAD_B;

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

  // Three faint horizontal gridlines across the plot area.
  const gridYs = [PAD_T, (PAD_T + baseY) / 2, baseY];

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

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
        style={{ display: "block", width: "100%", height: 130, marginTop: 8 }}
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

        {target != null ? (
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 11,
          color: MUTED,
          marginTop: 4,
        }}
      >
        <span>{fmt(dataLo)}</span>
        {target != null && targetLabel ? <span>{targetLabel}</span> : null}
        <span>{fmt(dataHi)}</span>
      </div>
    </div>
  );
}
