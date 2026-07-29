// Presentational accountability widgets for the Today screen (R6). No server
// imports and no state: they render numbers the parent already computed in
// code, so nothing here invents or recomputes a score. Inline styles only, in
// the same spirit as PartnerView (never depends on the CSS bundle).

import Link from "next/link";
import { dayGradeTone, weekGradeTone } from "@/lib/score/score";
import { eur, type ScoreGradeDay, type ScoreGradeWeek } from "@/lib/score/config";

export type ScoreChipData = {
  points: number;
  max: number;
  grade: ScoreGradeDay;
  locked: boolean;
  lockRule: "green" | "green3" | null;
};

// The richer set the Today accountability card renders (fund + week + pending).
export type TodayScoreData = ScoreChipData & {
  weekPoints: number;
  weekMax: number;
  weekProjection: ScoreGradeWeek;
  fundName: string;
  fundBalance: number;
  fundTargetEur: number | null;
  fundPct: number | null;
  pendingFinesTotal: number;
  pendingRunsCount: number;
};

// grade tone -> CSS var (green/yellow/red/black per the doctrine map)
const TONE_COLOR: Record<ReturnType<typeof dayGradeTone>, string> = {
  green: "var(--good)",
  yellow: "var(--warn)",
  red: "var(--bad)",
  black: "var(--text)",
};

// A small calm pill: today's points and the grade word, colored by tone.
// Tapping it opens the score detail on /weekly.
export function ScoreChip({ points, max, grade }: ScoreChipData) {
  const color = TONE_COLOR[dayGradeTone(grade)];
  return (
    <Link
      href="/weekly"
      title={`Today's score: ${points} of ${max}, ${grade}. Open detail.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        fontSize: 12,
        lineHeight: 1.4,
        fontVariantNumeric: "tabular-nums",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {points}/{max}
      </span>
      <span style={{ opacity: 0.85 }}>{grade}</span>
    </Link>
  );
}

// A full-width red banner. The parent only renders it when the lock is active.
export function LockedBanner({ rule }: { rule: "green" | "green3" | null }) {
  const until =
    rule === "green3" ? "Until three consecutive Green days." : "Until a Green day.";
  return (
    <div
      role="status"
      style={{
        border: "1px solid var(--bad)",
        background: "color-mix(in srgb, var(--bad) 12%, transparent)",
        color: "var(--bad)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Entertainment locked. {until}
    </div>
  );
}

// A compact accountability card for Today: the fund progress toward its target,
// this week's standing, and anything outstanding. Numbers come from the parent
// (computed in code); this only displays them. Taps through to /weekly.
export function TodayScoreCard({ data }: { data: TodayScoreData }) {
  const weekColor = TONE_COLOR[weekGradeTone(data.weekProjection)];
  const hasTarget = data.fundTargetEur != null && data.fundTargetEur > 0;
  const pct = data.fundPct ?? 0;
  const outstanding = data.pendingFinesTotal > 0 || data.pendingRunsCount > 0;

  return (
    <div className="card">
      <div className="card-head-row">
        <span className="block-title">Accountability</span>
        <Link href="/weekly" className="link" style={{ fontSize: 13 }}>
          Details
        </Link>
      </div>

      {/* Fund */}
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>{data.fundName}</span>
          <span
            className="muted"
            style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
          >
            {hasTarget
              ? `${eur(data.fundBalance)} / ${eur(data.fundTargetEur as number)}`
              : `${eur(data.fundBalance)}`}
          </span>
        </div>
        {hasTarget ? (
          <span
            style={{
              display: "block",
              height: 8,
              borderRadius: 999,
              background: "var(--panel-2)",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${pct}%`,
                background: "var(--accent)",
              }}
            />
          </span>
        ) : null}
      </div>

      {/* Week standing + outstanding */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 12,
          fontSize: 13,
        }}
      >
        <span className="muted">
          This week {data.weekPoints}/{data.weekMax}, grade so far{" "}
          <span style={{ color: weekColor, fontWeight: 700 }}>{data.weekProjection}</span>
        </span>
        <span className="muted" style={{ flexShrink: 0, textAlign: "right" }}>
          {outstanding
            ? `${eur(data.pendingFinesTotal)} fines${
                data.pendingRunsCount > 0 ? `, ${data.pendingRunsCount} run${data.pendingRunsCount > 1 ? "s" : ""}` : ""
              } to clear`
            : "nothing outstanding"}
        </span>
      </div>
    </div>
  );
}
