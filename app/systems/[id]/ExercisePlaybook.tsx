"use client";

import { useRef, useState } from "react";
import { localDateStr } from "@/lib/constants";
import {
  computeExerciseStats,
  type ExerciseConfig,
  type ExerciseLog,
  type Routine,
  type SessionType,
} from "@/lib/exercise/exercise";
import { saveExerciseConfig } from "@/app/exercise/actions";
import EditableList from "@/components/EditableList";
import ToggleRow from "@/components/ToggleRow";

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

  const minNames = cfg.routines
    .filter((r) => r.track && r.min)
    .map((r) => r.name);
  const caption =
    minNames.length > 0
      ? `Min every day (${minNames.join(" plus ")}), ${stats.sessionsTarget} real sessions a week. Scale the session down on a low day, never skip the Min.`
      : `Hold the Min every day, ${stats.sessionsTarget} real sessions a week.`;

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

  function setRoutine(i: number, patch: Partial<Routine>) {
    const routines = cfgRef.current.routines.map((r, j) =>
      j === i ? { ...r, ...patch } : r
    );
    update({ ...cfgRef.current, routines });
  }

  function removeRoutine(i: number) {
    const r = cfgRef.current.routines[i];
    if (!window.confirm(`Remove "${r.name}"? This cannot be undone.`)) return;
    update({
      ...cfgRef.current,
      routines: cfgRef.current.routines.filter((_, j) => j !== i),
    });
    commit("Routine removed.");
  }

  function addRoutine() {
    const r: Routine = {
      id: crypto.randomUUID(),
      name: "New routine",
      items: [],
      min: false,
      track: true,
    };
    update({ ...cfgRef.current, routines: [...cfgRef.current.routines, r] });
    commit("Routine added.");
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
            <div className="step-cap">day Min streak</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}>
          {caption}
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

      {/* Routines */}
      {cfg.routines.map((r, i) => (
        <div className="card" key={r.id}>
          <div className="field">
            <label>Routine name</label>
            <input
              value={r.name}
              onChange={(e) => setRoutine(i, { name: e.target.value })}
              onBlur={() => commit("Routine saved.")}
            />
          </div>

          <div className="field">
            <label>Items</label>
            <EditableList
              items={r.items}
              placeholder="Add an item"
              onChange={(items) => setRoutine(i, { items })}
              onCommit={() => commit("Routine saved.")}
            />
          </div>

          <div className="toggle-list">
            <ToggleRow
              label="Log daily on Today"
              on={r.track}
              onClick={() => {
                setRoutine(i, { track: !r.track });
                commit("Routine saved.");
              }}
            />
            <div style={r.track ? undefined : { opacity: 0.5 }}>
              <ToggleRow
                label="Counts toward the daily Min"
                on={r.min}
                onClick={() => {
                  if (!r.track) return;
                  setRoutine(i, { min: !r.min });
                  commit("Routine saved.");
                }}
              />
            </div>
          </div>

          <button
            className="btn btn-ghost btn-auto btn-danger"
            style={{ marginTop: 12 }}
            onClick={() => removeRoutine(i)}
          >
            Remove routine
          </button>
        </div>
      ))}

      <button className="btn btn-ghost btn-auto" onClick={addRoutine}>
        + Add routine
      </button>

      <p className="muted" style={{ marginTop: 0, marginBottom: 0, fontSize: 13 }}>
        Normal soreness is fine. Sharp or lingering pain means back off and see a
        physio. General guidance, not treatment.
      </p>
    </div>
  );
}
