"use client";

import { useState } from "react";
import NumberField from "@/components/NumberField";
import { localDateStr } from "@/lib/constants";
import {
  computeSleepStats,
  HOLD_DAYS,
  nextWake,
  targetBedtime,
  type SleepConfig,
} from "@/lib/sleep/sleep";
import { saveSleepConfig } from "@/app/sleep/actions";

const WIND_DOWN = [
  "Dim the lights and drop screen brightness (night mode).",
  "Prep tomorrow: lay out training clothes, set the next action.",
  "Read, fiction or non-fiction, until sleepy.",
];

export default function SleepPlaybook({
  config,
  recentWakes,
}: {
  config: SleepConfig;
  recentWakes: { date: string; wake: string | null }[];
}) {
  const [cfg, setCfg] = useState<SleepConfig>(config);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = computeSleepStats(cfg, recentWakes);

  async function persist(next: SleepConfig, message: string) {
    setCfg(next);
    setSaving(true);
    setError(null);
    const res = await saveSleepConfig(next);
    setSaving(false);
    if ("error" in res) setError(res.error);
    else setMsg(message);
  }

  function advance() {
    if (stats.atGoal) return;
    persist(
      { ...cfg, currentWake: nextWake(cfg), stepStartedOn: localDateStr() },
      `Step advanced to ${nextWake(cfg)}. Hold it.`
    );
  }

  function saveEdits() {
    // Editing the current wake restarts the hold window.
    persist({ ...cfg, stepStartedOn: localDateStr() }, "Sleep step saved.");
  }

  return (
    <div className="stack">
      {/* Current step */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Current step</span>
          {msg ? <span className="muted" style={{ fontSize: 12 }}>{msg}</span> : null}
        </div>
        <div className="step-row">
          <div className="step-big">
            <div className="step-num">{cfg.currentWake}</div>
            <div className="step-cap">target wake</div>
          </div>
          <div className="step-big">
            <div className="step-num">{targetBedtime(cfg)}</div>
            <div className="step-cap">target bed tonight</div>
          </div>
          <div className="step-big">
            <div className="step-num">{cfg.goalWake}</div>
            <div className="step-cap">goal wake</div>
          </div>
        </div>

        <div className="step-stats">
          <span className={`stat-pill${stats.eligible ? " good" : ""}`}>
            Hold streak {stats.holdStreak}/{HOLD_DAYS}
          </span>
          <span className="stat-pill">
            In step {stats.withinCount}/{stats.totalLogged} days
          </span>
          {stats.latestWake ? (
            <span className={`stat-pill${stats.driftMin != null && stats.driftMin > 30 ? " bad" : ""}`}>
              Last wake {stats.latestWake}
              {stats.driftMin != null && stats.driftMin > 0
                ? ` (${stats.driftMin} min late)`
                : ""}
            </span>
          ) : (
            <span className="stat-pill">No wake logged yet</span>
          )}
        </div>

        {stats.atGoal ? (
          <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
            You are at your goal wake time. Hold it. The system is now maintenance.
          </p>
        ) : (
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary btn-auto"
              onClick={advance}
              disabled={saving}
            >
              Advance to {nextWake(cfg)}
            </button>
            <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
              {stats.eligible
                ? "You have held the step. Advance is recommended."
                : `Hold the step ${HOLD_DAYS} days before advancing.`}
            </span>
          </div>
        )}
      </div>

      {/* Edit the step */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Tune the shift
        </div>
        <div className="form-row">
          <div className="field">
            <label>Current target wake</label>
            <input
              type="time"
              value={cfg.currentWake}
              onChange={(e) => setCfg({ ...cfg, currentWake: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Goal wake</label>
            <input
              type="time"
              value={cfg.goalWake}
              onChange={(e) => setCfg({ ...cfg, goalWake: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Step size</label>
            <select
              value={cfg.stepMinutes}
              onChange={(e) =>
                setCfg({ ...cfg, stepMinutes: Number(e.target.value) })
              }
            >
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>
          <div className="field">
            <label>Target sleep (hours)</label>
            <NumberField
              value={cfg.sleepHours}
              onValue={(n) => setCfg({ ...cfg, sleepHours: n ?? 8 })}
              allowEmpty
            />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-auto" onClick={saveEdits} disabled={saving}>
            Save step
          </button>
        </div>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* Morning light */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Morning light (your strongest lever)
        </div>
        <p style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.55 }}>
          Within 30 to 60 minutes of waking, get outside. 5 to 10 minutes on a
          clear day, 15 to 20 if overcast. No sunglasses. It anchors your clock
          and pulls the whole rhythm earlier. Non-negotiable.
        </p>
      </div>

      {/* Wind-down */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Wind-down, about 45 to 60 min before bed
        </div>
        <ol className="checklist">
          {WIND_DOWN.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          Screens are the hard part. In the last 45 minutes, dim hard, night
          mode, and swap the movie for the book. Same order every night so it
          runs itself.
        </p>
      </div>

      {/* Floor */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          The floor (bad night)
        </div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          Wake at target anyway. Do not sleep in to catch up, that drags the
          clock backward and undoes the step. If wrecked, one nap of 20 minutes
          max in the early afternoon, never late.
        </p>
      </div>
    </div>
  );
}
