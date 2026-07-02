"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Goal, LinkChoice, Quarter } from "@/lib/goals/goals";

const QUARTERS: Quarter[] = [1, 2, 3, 4];

type PersistResult = { ok: true } | { error: string } | void;

// What drives this goal's bar, so a linked goal is never a mystery.
function progressHint(g: Goal): string {
  switch (g.link) {
    case "sleep_wake":
      return "Fills as your wake target shifts from your start time toward your goal wake. It moves when you advance the step in the Sleep playbook (after holding the current wake for a few days), not from a daily check.";
    case "training_sessions":
      return "Fills with your sessions this week against your weekly target. Log training and it moves on its own.";
    case "diet_protein":
      return "Fills with the share of recent days you hit your protein target. Log your protein and it moves on its own.";
    default:
      return g.milestones.length > 0
        ? "Manual: fills as you check off the milestones below."
        : "Manual: drag the slider to set it, or add milestones and it fills as you check them off.";
  }
}

export default function GoalsCard({
  initialGoals,
  year,
  thisQuarter,
  progressFor,
  linkChoices,
  onPersist,
  fullViewHref,
}: {
  initialGoals: Goal[];
  year: number;
  thisQuarter: Quarter;
  progressFor: (g: Goal) => number;
  linkChoices: LinkChoice[];
  onPersist: (goals: Goal[]) => Promise<PersistResult> | void;
  fullViewHref?: string;
}) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const goalsRef = useRef<Goal[]>(initialGoals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestoneText, setMilestoneText] = useState("");

  // Goals persist on their own, decoupled from the daily entry save:
  // structural changes commit immediately, typing commits debounced, and the
  // result is shown so a failed save is never silent.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;

  function update(next: Goal[]) {
    goalsRef.current = next;
    setGoals(next);
  }

  async function commit() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await onPersistRef.current(goalsRef.current);
      if (res && "error" in res) {
        setSaveState("error");
        setSaveError(res.error);
      } else {
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
      setSaveError("Could not reach the server.");
    }
  }

  // Debounced commit for text fields, so edits save while typing pauses.
  function commitSoon() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void commit();
    }, 600);
  }

  // Flush a pending debounced save if the card unmounts (navigation).
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void onPersistRef.current(goalsRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      linkedSystemId: null,
      link: "manual",
      manualProgress: 0,
      notes: "",
      milestones: [],
      status: "active",
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
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saveState === "saving" ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Saving...
            </span>
          ) : saveState === "saved" ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Saved.
            </span>
          ) : null}
          {fullViewHref ? (
            <Link href={fullViewHref} className="link" style={{ fontSize: 13 }}>
              Full view
            </Link>
          ) : null}
          <button className="btn btn-ghost btn-auto" onClick={addGoal}>
            + Add goal
          </button>
        </span>
      </div>

      {saveState === "error" ? (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          Goals did not save{saveError ? `: ${saveError}` : "."}{" "}
          <button className="link" onClick={() => void commit()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="quarter-grid">
        {QUARTERS.map((q) => (
          <div
            key={q}
            className={`quarter-col${q === thisQuarter ? " current" : ""}`}
          >
            <div className="quarter-label">Q{q}</div>
            <div className="quarter-goals">
              {goals
                .filter((g) => g.quarter === q && g.year === year)
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
              {goals.filter((g) => g.quarter === q && g.year === year).length === 0 ? (
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
                onChange={(e) => {
                  patch(selected.id, { title: e.target.value });
                  commitSoon();
                }}
                onBlur={() => void commit()}
              />
            </div>
            <div className="field">
              <label>Why (one word)</label>
              <input
                value={selected.why}
                onChange={(e) => {
                  patch(selected.id, { why: e.target.value });
                  commitSoon();
                }}
                onBlur={() => void commit()}
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
                value={selected.linkedSystemId ?? ""}
                onChange={(e) => {
                  const choice =
                    linkChoices.find((c) => c.value === e.target.value) ??
                    linkChoices[0];
                  patch(selected.id, {
                    linkedSystemId: choice.value || null,
                    link: choice.kind,
                  });
                  commit();
                }}
              >
                {linkChoices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
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
          <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
            {progressHint(selected)}
          </p>

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
                onMouseUp={() => void commit()}
                onTouchEnd={() => void commit()}
              />
            </div>
          ) : null}

          <div className="field">
            <label>Notes</label>
            <textarea
              rows={2}
              value={selected.notes}
              onChange={(e) => {
                patch(selected.id, { notes: e.target.value });
                commitSoon();
              }}
              onBlur={() => void commit()}
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
              onClick={() => {
                void commit();
                setSelectedId(null);
              }}
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
