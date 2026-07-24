// Presentational accountability widgets for the Today screen (R6). No server
// imports and no state: they render numbers the parent already computed in
// code, so nothing here invents or recomputes a score. Inline styles only, in
// the same spirit as PartnerView (never depends on the CSS bundle).

import Link from "next/link";
import { dayGradeTone } from "@/lib/score/score";
import type { ScoreGradeDay } from "@/lib/score/config";

export type ScoreChipData = {
  points: number;
  max: number;
  grade: ScoreGradeDay;
  locked: boolean;
  lockRule: "green" | "green3" | null;
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
