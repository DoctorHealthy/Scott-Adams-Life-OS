"use client";

import { useRef, useState } from "react";
import { localDateStr } from "@/lib/constants";
import {
  computeExerciseStats,
  type ExerciseConfig,
  type ExerciseLog,
  type SessionType,
} from "@/lib/exercise/exercise";
import { saveExerciseConfig } from "@/app/exercise/actions";
import EditableList from "@/components/EditableList";

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
  const cfgRef = useRef<ExerciseConfig>(config);
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = localDateStr();
  const stats = computeExerciseStats(cfg, recent, today);
  const sessionsOk = stats.sessionsLast7 >= stats.sessionsTarget;

  function update(next: ExerciseConfig) {
    cfgRef.current = next;
    setCfg(next);
  }

  async function commit(message: string) {
    setSaving(true);
    setError(null);
    const res = await saveExerciseConfig(cfgRef.current);
    setSaving(false);
    if ("error" in res) setError(res.error);
    else setMsg(message);
  }

  function addType() {
    const label = newType.trim();
    if (!label) return;
    const t: SessionType = { id: `custom-${crypto.randomUUID()}`, label };
    update({ ...cfgRef.current, sessionTypes: [...cfgRef.current.sessionTypes, t] });
    commit("Session menu saved.");
    setNewType("");
  }

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

      {/* Setup */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Setup
        </div>
        <div className="field">
          <label>Sessions a week target</label>
          <select
            value={cfg.sessionsTarget}
            onChange={(e) => {
              update({ ...cfgRef.current, sessionsTarget: Number(e.target.value) });
              commit("Weekly target saved.");
            }}
            disabled={saving}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} a week
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Session menu (edit, remove, or add types)</label>
          <div className="edit-list">
            {cfg.sessionTypes.map((t, i) => (
              <div className="edit-row" key={t.id}>
                <input
                  value={t.label}
                  onChange={(e) => {
                    const next = cfgRef.current.sessionTypes.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x
                    );
                    update({ ...cfgRef.current, sessionTypes: next });
                  }}
                  onBlur={() => commit("Session menu saved.")}
                />
                <button
                  className="edit-x"
                  aria-label="Remove"
                  onClick={() => {
                    update({
                      ...cfgRef.current,
                      sessionTypes: cfgRef.current.sessionTypes.filter(
                        (_, j) => j !== i
                      ),
                    });
                    commit("Session menu saved.");
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="edit-row">
              <input
                placeholder="Add a session type (e.g. Swim)"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addType();
                }}
              />
              <button className="btn btn-auto" onClick={addType} disabled={!newType.trim()}>
                Add
              </button>
            </div>
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

      {/* Daily warm-up (editable) */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Daily Ondra-style warm-up (edit your own)
        </div>
        <EditableList
          items={cfg.warmup}
          placeholder="Add a warm-up move"
          onChange={(items) => update({ ...cfgRef.current, warmup: items })}
          onCommit={() => commit("Warm-up saved.")}
        />
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

      {/* Ankle (editable) */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Left-ankle prehab (edit your own)
        </div>
        <EditableList
          items={cfg.ankle}
          placeholder="Add an ankle exercise"
          onChange={(items) => update({ ...cfgRef.current, ankle: items })}
          onCommit={() => commit("Ankle routine saved.")}
        />
        <p className="muted" style={{ marginBottom: 0, marginTop: 8, fontSize: 13 }}>
          Normal soreness is fine. Sharp or lingering pain means back off and see
          a physio. General guidance, not treatment.
        </p>
      </div>
    </div>
  );
}
