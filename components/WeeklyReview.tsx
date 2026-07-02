"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prettyDate } from "@/lib/constants";
import { WEEKDAY_LABELS } from "@/lib/review/config";
import { setWeeklyReviewDay } from "@/app/weekly/actions";
import type { WeeklyStats } from "@/lib/review/weekly";

const LABEL_TEXT: Record<WeeklyStats["systems"][number]["label"], string> = {
  autopilot: "autopilot",
  willpower: "willpower",
  attention: "needs attention",
};

function StatsView({ stats }: { stats: WeeklyStats }) {
  const e = stats.energy;
  return (
    <div className="stack">
      <div className="card">
        <div className="block-title">Energy</div>
        <div className="review-stat-row">
          <span>Average</span>
          <span>{e.avg ?? "not logged"}{e.avg != null ? " / 10" : ""}</span>
        </div>
        <div className="review-stat-row">
          <span>Range</span>
          <span>{e.min != null ? `${e.min} to ${e.max}` : "not logged"}</span>
        </div>
        <div className="review-stat-row">
          <span>Direction</span>
          <span>{e.direction}</span>
        </div>
        <div className="review-stat-row">
          <span>Days logged</span>
          <span>{stats.daysLogged} of 7</span>
        </div>
      </div>

      <div className="card">
        <div className="block-title">System adherence</div>
        {stats.systems.map((s) => (
          <div className="review-sys-row" key={s.id}>
            <span className="review-sys-name">{s.name}</span>
            <span className="review-sys-counts muted">
              {s.done} done, {s.floor} floor, {s.skip} skip
            </span>
            <span className={`review-badge badge-${s.label}`}>
              {LABEL_TEXT[s.label]}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="block-title">Energy patterns</div>
        {stats.correlations.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            No pattern strong enough to call this week. Keep logging.
          </p>
        ) : (
          stats.correlations.map((c) => (
            <div className="review-stat-row" key={c.name}>
              <span>{c.name}</span>
              <span>
                {c.energyOn} on done days vs {c.energyOff} otherwise (
                {c.gap > 0 ? "+" : ""}
                {c.gap})
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="block-title">Sleep-shift campaign</div>
        <div className="review-stat-row">
          <span>Step</span>
          <span>{stats.sleep.stepNumber}, wake target {stats.sleep.currentWake}</span>
        </div>
        <div className="review-stat-row">
          <span>Hold streak</span>
          <span>
            {stats.sleep.holdStreak} of {stats.sleep.holdDays}
            {stats.sleep.atGoal
              ? " (at goal)"
              : stats.sleep.eligible
                ? ` (advance to ${stats.sleep.nextWake})`
                : " (keep holding)"}
          </span>
        </div>
      </div>

      {stats.goals.length > 0 ? (
        <div className="card">
          <div className="block-title">Goal movement</div>
          {stats.goals.map((g) => (
            <div className="review-stat-row" key={g.id}>
              <span>{g.title}</span>
              <span>
                {g.progress}%
                {g.delta == null
                  ? " (baseline)"
                  : g.delta === 0
                    ? " (no change)"
                    : ` (${g.delta > 0 ? "+" : ""}${g.delta} pts)`}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function WeeklyReview({
  today,
  initialStats,
  initialNarration,
  initialPeriodEnd,
  weeklyDay,
  past,
}: {
  today: string;
  initialStats: WeeklyStats | null;
  initialNarration: string | null;
  initialPeriodEnd: string | null;
  weeklyDay: number;
  past: { period_start: string; period_end: string }[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState<WeeklyStats | null>(initialStats);
  const [narration, setNarration] = useState<string | null>(initialNarration);
  const [shownEnd, setShownEnd] = useState<string | null>(initialPeriodEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ranForToday = shownEnd === today;

  async function run() {
    setLoading(true);
    setError(null);
    setBusy(false);
    try {
      const res = await fetch("/api/coach/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBusy(!!json?.busy);
        setError(
          json?.busy
            ? "Coach is busy right now. Tap to retry."
            : json?.error || `Request failed (${res.status}).`
        );
      } else {
        setStats(json.stats as WeeklyStats);
        setNarration(json.text as string);
        setShownEnd(today);
        router.refresh();
      }
    } catch {
      setBusy(true);
      setError("Coach is busy right now. Tap to retry.");
    }
    setLoading(false);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head-row">
          <span className="block-title">This week</span>
          <label className="review-day-select">
            <span className="muted" style={{ fontSize: 12 }}>
              Review day
            </span>
            <select
              value={weeklyDay}
              onChange={async (ev) => {
                await setWeeklyReviewDay(Number(ev.target.value));
                router.refresh();
              }}
            >
              {WEEKDAY_LABELS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        {stats ? (
          <p className="muted" style={{ margin: "2px 0 12px", fontSize: 13 }}>
            {prettyDate(stats.start)} to {prettyDate(stats.end)}
            {ranForToday ? "" : " (last run; run again for the latest 7 days)"}
          </p>
        ) : (
          <p className="muted" style={{ margin: "2px 0 12px", fontSize: 13 }}>
            No weekly review yet. Run it to read your last 7 days.
          </p>
        )}

        <button className="btn btn-primary btn-auto" onClick={run} disabled={loading}>
          {loading
            ? "Thinking..."
            : ranForToday
              ? "Re-run this week's review"
              : "Run this week's review"}
        </button>

        {error ? (
          busy ? (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          ) : (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )
        ) : null}
      </div>

      {narration ? (
        <div className="card">
          <div className="block-head">
            <span className="block-title">Coach</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Reads your saved numbers. Never invents them.
            </span>
          </div>
          <div className="coach-output">{narration}</div>
        </div>
      ) : null}

      {stats ? <StatsView stats={stats} /> : null}

      {past.length > 0 ? (
        <div className="card">
          <div className="block-title">Past reviews</div>
          {past.map((r) => (
            <div className="review-stat-row muted" key={r.period_end}>
              <span>
                {prettyDate(r.period_start)} to {prettyDate(r.period_end)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
