"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prettyDate } from "@/lib/constants";
import type { MonthlyStats, MonthNumbers } from "@/lib/review/monthly";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="review-row">
      <span className="rk">{k}</span>
      <span className="rv">{v}</span>
    </div>
  );
}

function delta(cur: number | null, prev: number | null | undefined, unit: string) {
  if (cur == null || prev == null) return "";
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return " (no change)";
  return ` (${d > 0 ? "+" : ""}${d}${unit} vs last month)`;
}

function MonthCard({ m, prev }: { m: MonthNumbers; prev: MonthNumbers | null }) {
  const weight =
    m.weightFirst != null && m.weightLast != null
      ? `${m.weightFirst} to ${m.weightLast} kg`
      : m.weightLast != null
        ? `${m.weightLast} kg (one weigh-in)`
        : "not logged";
  return (
    <div className="card">
      <div className="block-title">The month in numbers</div>
      <div className="review-rows">
        <Row k="Days logged" v={`${m.daysLogged} of ${m.daysInWindow}`} />
        <Row
          k="Energy average"
          v={
            m.energyAvg != null
              ? `${m.energyAvg} / 10${delta(m.energyAvg, prev?.energyAvg, "")}`
              : "not logged"
          }
        />
        <Row
          k="Sleep consistency"
          v={
            m.sleepConsistencyPct != null
              ? `${m.sleepConsistencyPct}%${delta(m.sleepConsistencyPct, prev?.sleepConsistencyPct, " pts")}`
              : "not logged"
          }
        />
        <Row
          k="System adherence"
          v={
            m.adherencePct != null
              ? `${m.adherencePct}%${delta(m.adherencePct, prev?.adherencePct, " pts")}`
              : "not logged"
          }
        />
        <Row
          k="Protein average"
          v={
            m.proteinAvg != null
              ? `${m.proteinAvg} g${delta(m.proteinAvg, prev?.proteinAvg, " g")}`
              : "not logged"
          }
        />
        <Row k="Weight" v={weight} />
      </div>
    </div>
  );
}

export default function MonthlyReview({
  today,
  initialStats,
  initialNarration,
  initialPeriodEnd,
  past,
}: {
  today: string;
  initialStats: MonthlyStats | null;
  initialNarration: string | null;
  initialPeriodEnd: string | null;
  past: { period_start: string; period_end: string }[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState<MonthlyStats | null>(initialStats);
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
      const res = await fetch("/api/coach/monthly", {
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
        setStats(json.stats as MonthlyStats);
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
        <div className="block-title">This month</div>
        {stats ? (
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
            {prettyDate(stats.start)} to {prettyDate(stats.end)}
            {ranForToday ? "" : " (last run; run again to include the latest days)"}
          </p>
        ) : (
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
            No monthly review yet. Best run near month end.
          </p>
        )}
        <button className="btn btn-primary btn-auto" onClick={run} disabled={loading}>
          {loading
            ? "Thinking..."
            : ranForToday
              ? "Re-run this month's review"
              : "Run this month's review"}
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

      {stats ? (
        <>
          <MonthCard m={stats.month} prev={stats.prev} />

          <div className="card">
            <div className="block-title">Systems this month</div>
            <div className="review-rows">
              {stats.systems.map((s) => (
                <Row
                  key={s.id}
                  k={s.name}
                  v={`${s.done} done, ${s.floor} floor, ${s.skip} skip${
                    s.ranPct != null ? ` (ran ${s.ranPct}%)` : ""
                  }`}
                />
              ))}
            </div>
          </div>

          {stats.goals.length > 0 ? (
            <div className="card">
              <div className="block-title">Goals</div>
              <div className="review-rows">
                {stats.goals.map((g) => (
                  <Row
                    key={g.id}
                    k={g.title}
                    v={`${g.progress}%${
                      g.delta == null
                        ? " (baseline)"
                        : g.delta === 0
                          ? " (no movement)"
                          : ` (${g.delta > 0 ? "+" : ""}${g.delta} pts)`
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {past.length > 0 ? (
        <div className="card">
          <div className="block-title">Past monthly reviews</div>
          <div className="review-rows">
            {past.map((r) => (
              <Row
                key={r.period_end}
                k={r.period_start.slice(0, 7)}
                v={`${prettyDate(r.period_start)} to ${prettyDate(r.period_end)}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
