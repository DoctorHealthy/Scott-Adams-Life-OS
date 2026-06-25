"use client";

import { useState } from "react";
import { localDateStr } from "@/lib/constants";
import {
  computeExerciseStats,
  type ExerciseConfig,
  type ExerciseLog,
  type SessionType,
} from "@/lib/exercise/exercise";
import { saveExerciseConfig } from "@/app/exercise/actions";

const WARMUP = [
  "Light cardio, 2 to 3 min (jog in place, jumping jacks, skipping).",
  "Joint circles: ankles, knees, hips, shoulders, wrists.",
  "Dynamic stretches: leg swings, walking lunges with torso rotation, arm swings.",
  "Scapular activation: band pull-aparts or scap push-ups.",
  "Hip openers: 90/90 transitions, a deep squat hold.",
  "Finger and forearm prep: open-close the hands, wrist circles, light hangs.",
  "A set of push-ups to fire up the antagonists.",
];

const ANKLE = [
  "Calf raises, straight knee: 3 x 15 to 20.",
  "Calf raises, bent knee (soleus): 3 x 15 to 20.",
  "Eccentric heel drops off a step: 3 x 10 to 15, slow lower.",
  "Banded ankle, all four directions: 2 to 3 x 15 each.",
  "Tibialis raises (toes up against a wall): 3 x 20.",
  "Single-leg balance: 3 x 30 to 45 s, progress to eyes closed.",
  "Knee-to-wall ankle mobility: 3 x 10 per side.",
];

const STRUCTURE = [
  {
    title: "Strength-endurance (2 a week)",
    body: "Higher-rep, density circuits, short rest. Push (push-up variations, pike, dips), pull (pull-ups, rows, hangs for grip), legs (lunges, Bulgarian split squats, pistols, jump squats), core (hollow holds, hanging leg raises, planks). Pick 4 to 5 moves, 3 to 4 rounds, EMOM or AMRAP.",
  },
  {
    title: "Power (1 a week)",
    body: "Explosive, low reps, full recovery, max intent. Box or broad jumps, plyo push-ups, kettlebell swings, med-ball throws. Outdoors: hill sprints, short and hard with full rest. Quality over fatigue.",
  },
  {
    title: "Climbing / sport day",
    body: "Bouldering counts as a full session. Warm the fingers first, easy problems before hard. Tennis or basketball counts too.",
  },
];

export default function ExercisePlaybook({
  config,
  recent,
}: {
  config: ExerciseConfig;
  recent: { date: string; log: ExerciseLog }[];
}) {
  const [cfg, setCfg] = useState<ExerciseConfig>(config);
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = localDateStr();
  const stats = computeExerciseStats(cfg, recent, today);

  async function persist(next: ExerciseConfig, message: string) {
    setCfg(next);
    setSaving(true);
    setError(null);
    const res = await saveExerciseConfig(next);
    setSaving(false);
    if ("error" in res) setError(res.error);
    else setMsg(message);
  }

  function setTarget(n: number) {
    persist({ ...cfg, sessionsTarget: n }, "Weekly target saved.");
  }

  function addType() {
    const label = newType.trim();
    if (!label) return;
    const t: SessionType = { id: `custom-${crypto.randomUUID()}`, label };
    setNewType("");
    persist({ ...cfg, sessionTypes: [...cfg.sessionTypes, t] }, "Session type added.");
  }

  function removeType(id: string) {
    persist(
      { ...cfg, sessionTypes: cfg.sessionTypes.filter((t) => t.id !== id) },
      "Session type removed."
    );
  }

  const sessionsOk = stats.sessionsLast7 >= stats.sessionsTarget;

  return (
    <div className="stack">
      {/* Stats */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">This week</span>
          {msg ? <span className="muted" style={{ fontSize: 12 }}>{msg}</span> : null}
        </div>
        <div className="step-row">
          <div className="step-big">
            <div className={`step-num${sessionsOk ? " ok" : ""}`}>
              {stats.sessionsLast7}/{stats.sessionsTarget}
            </div>
            <div className="step-cap">sessions, last 7 days</div>
          </div>
          <div className="step-big">
            <div className="step-num">{stats.floorStreak}</div>
            <div className="step-cap">day floor streak</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}>
          Floor every day (warm-up + ankle + walk), {stats.sessionsTarget} real
          sessions a week. Scale the session down on a low day, never skip the
          floor.
        </p>
      </div>

      {/* Config */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Setup
        </div>
        <div className="field">
          <label>Sessions a week target</label>
          <select
            value={cfg.sessionsTarget}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={saving}
          >
            <option value={3}>3 a week</option>
            <option value={4}>4 a week</option>
            <option value={5}>5 a week</option>
          </select>
        </div>
        <div className="field">
          <label>Session menu</label>
          <div className="type-chips">
            {cfg.sessionTypes.map((t) => {
              const custom = t.id.startsWith("custom-");
              return (
                <span className="type-chip" key={t.id}>
                  {t.label}
                  {custom ? (
                    <button
                      className="type-chip-x"
                      onClick={() => removeType(t.id)}
                      aria-label={`Remove ${t.label}`}
                    >
                      &times;
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <input
              placeholder="Add a session type (e.g. Swim)"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-auto" onClick={addType} disabled={!newType.trim() || saving}>
              Add type
            </button>
          </div>
        </div>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 4 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* Bad-day floor */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          The floor (bad day)
        </div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          Ondra warm-up, the ankle routine, and a 10-minute walk. That still
          counts. You scale down, you do not skip.
        </p>
      </div>

      {/* Daily warm-up */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Daily Ondra-style warm-up (10 to 15 min)
        </div>
        <ol className="checklist">
          {WARMUP.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>

      {/* Weekly structure */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Weekly session structure
        </div>
        <div className="struct-list">
          {STRUCTURE.map((s) => (
            <div className="struct-item" key={s.title}>
              <div className="struct-title">{s.title}</div>
              <div className="muted" style={{ lineHeight: 1.55 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ankle */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Left-ankle prehab (3 to 4 a week, 8 to 10 min)
        </div>
        <ol className="checklist">
          {ANKLE.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          Normal soreness is fine. Sharp or lingering pain means back off and see
          a physio. General guidance, not treatment.
        </p>
      </div>
    </div>
  );
}
