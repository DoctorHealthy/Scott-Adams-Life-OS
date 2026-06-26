"use client";

import { useRef, useState } from "react";
import {
  LINK_LABELS,
  type Goal,
  type GoalLink,
  type Quarter,
} from "@/lib/goals/goals";

const QUARTERS: Quarter[] = [1, 2, 3, 4];

export default function GoalsCard({
  initialGoals,
  year,
  thisQuarter,
  progressFor,
  onPersist,
}: {
  initialGoals: Goal[];
  year: number;
  thisQuarter: Quarter;
  progressFor: (g: Goal) => number;
  onPersist: (goals: Goal[]) => void;
}) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const goalsRef = useRef<Goal[]>(initialGoals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestoneText, setMilestoneText] = useState("");

  function update(next: Goal[]) {
    goalsRef.current = next;
    setGoals(next);
  }
  function commit() {
    onPersist(goalsRef.current);
  }
  function patch(id: string, fields: Partial<Goal>) {
    update(goalsRef.current.map((g) => (g.id === id ? { ...g, ...fields } : g)));
  }

  function addGoal() {
    const g: Goal = {
      id: crypto.randomUUID(),
      title: "New goal",
      why: "",
      quarter: thisQuarter,
      year,
      link: "manual",
      manualProgress: 0,
      notes: "",
      milestones: [],
    };
    update([...goalsRef.current, g]);
    commit();
    setSelectedId(g.id);
  }

  function removeGoal(id: string) {
    if (!window.confirm("Remove this goal?")) return;
    update(goalsRef.current.filter((g) => g.id !== id));
    commit();
    if (selectedId === id) setSelectedId(null);
  }

  const selected = goals.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="card">
      <div className="card-head-row">
        <span className="block-title">Goals</span>
        <button className="btn btn-ghost btn-auto" onClick={addGoal}>
          + Add goal
        </button>
      </div>

      <div className="quarter-grid">
        {QUARTERS.map((q) => (
          <div
            key={q}
            className={`quarter-col${q === thisQuarter ? " current" : ""}`}
          >
            <div className="quarter-label">Q{q}</div>
            <div className="quarter-goals">
              {goals
                .filter((g) => g.quarter === q)
                .map((g) => {
                  const pct = progressFor(g);
                  return (
                    <button
                      key={g.id}
                      className={`goal-chip${selectedId === g.id ? " on" : ""}`}
                      onClick={() =>
                        setSelectedId((s) => (s === g.id ? null : g.id))
                      }
                    >
                      <span className="goal-chip-title">{g.title}</span>
                      {g.why ? (
                        <span className="goal-chip-why">{g.why}</span>
                      ) : null}
                      <span className="goal-bar">
                        <span className="goal-bar-fill" style={{ width: `${pct}%` }} />
                      </span>
                    </button>
                  );
                })}
              {goals.filter((g) => g.quarter === q).length === 0 ? (
                <div className="quarter-empty muted">&mdash;</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="goal-editor">
          <div className="form-row">
            <div className="field">
              <label>Title</label>
              <input
                value={selected.title}
                onChange={(e) => patch(selected.id, { title: e.target.value })}
                onBlur={commit}
              />
            </div>
            <div className="field">
              <label>Why (one word)</label>
              <input
                value={selected.why}
                onChange={(e) => patch(selected.id, { why: e.target.value })}
                onBlur={commit}
                placeholder="e.g. freedom"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Quarter</label>
              <select
                value={selected.quarter}
                onChange={(e) => {
                  patch(selected.id, { quarter: Number(e.target.value) as Quarter });
                  commit();
                }}
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Progress source</label>
              <select
                value={selected.link}
                onChange={(e) => {
                  patch(selected.id, { link: e.target.value as GoalLink });
                  commit();
                }}
              >
                {LINK_LABELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="goal-progress-line">
            <span className="muted" style={{ fontSize: 13 }}>
              Progress: {progressFor(selected)}%
              {selected.link !== "manual" ? " (from your systems)" : ""}
            </span>
          </div>

          {selected.link === "manual" && selected.milestones.length === 0 ? (
            <div className="field">
              <label>Manual progress: {selected.manualProgress}%</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={selected.manualProgress}
                onChange={(e) =>
                  patch(selected.id, { manualProgress: Number(e.target.value) })
                }
                onMouseUp={commit}
                onTouchEnd={commit}
              />
            </div>
          ) : null}

          <div className="field">
            <label>Notes</label>
            <textarea
              rows={2}
              value={selected.notes}
              onChange={(e) => patch(selected.id, { notes: e.target.value })}
              onBlur={commit}
            />
          </div>

          <div className="field">
            <label>Milestones</label>
            <div className="milestone-list">
              {selected.milestones.map((m) => (
                <div className="milestone-row" key={m.id}>
                  <button
                    className={`milestone-check${m.done ? " on" : ""}`}
                    onClick={() => {
                      patch(selected.id, {
                        milestones: selected.milestones.map((x) =>
                          x.id === m.id ? { ...x, done: !x.done } : x
                        ),
                      });
                      commit();
                    }}
                  >
                    {m.done ? "✓" : ""}
                  </button>
                  <span className={`milestone-text${m.done ? " done" : ""}`}>
                    {m.text}
                  </span>
                  <button
                    className="edit-x"
                    onClick={() => {
                      patch(selected.id, {
                        milestones: selected.milestones.filter((x) => x.id !== m.id),
                      });
                      commit();
                    }}
                    aria-label="Remove milestone"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <div className="edit-row">
                <input
                  placeholder="Add a milestone"
                  value={milestoneText}
                  onChange={(e) => setMilestoneText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && milestoneText.trim()) {
                      patch(selected.id, {
                        milestones: [
                          ...selected.milestones,
                          {
                            id: crypto.randomUUID(),
                            text: milestoneText.trim(),
                            done: false,
                          },
                        ],
                      });
                      commit();
                      setMilestoneText("");
                    }
                  }}
                />
                <button
                  className="btn btn-auto"
                  disabled={!milestoneText.trim()}
                  onClick={() => {
                    patch(selected.id, {
                      milestones: [
                        ...selected.milestones,
                        {
                          id: crypto.randomUUID(),
                          text: milestoneText.trim(),
                          done: false,
                        },
                      ],
                    });
                    commit();
                    setMilestoneText("");
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="btn-row">
            <button
              className="btn btn-auto"
              onClick={() => setSelectedId(null)}
            >
              Done
            </button>
            <button
              className="btn btn-ghost btn-auto btn-danger"
              onClick={() => removeGoal(selected.id)}
            >
              Remove goal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
