"use client";

import { useRef, useState } from "react";
import EditableList from "@/components/EditableList";
import {
  itemsInQuadrant,
  QUADRANTS,
  type EisenhowerItem,
  type Quadrant,
  type ScheduleConfig,
} from "@/lib/schedule/schedule";
import { saveScheduleConfig } from "@/app/schedule/actions";

export default function SchedulePlaybook({
  config,
}: {
  config: ScheduleConfig;
}) {
  const [cfg, setCfg] = useState<ScheduleConfig>(config);
  const cfgRef = useRef<ScheduleConfig>(config);
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(next: ScheduleConfig) {
    cfgRef.current = next;
    setCfg(next);
  }

  async function commit(message: string) {
    setSaving(true);
    setError(null);
    const res = await saveScheduleConfig(cfgRef.current);
    setSaving(false);
    if ("error" in res) setError(res.error);
    else setMsg(message);
  }

  function addItem(q: Quadrant) {
    const text = (drafts[q] ?? "").trim();
    if (!text) return;
    const item: EisenhowerItem = { id: crypto.randomUUID(), text, quadrant: q };
    update({ ...cfgRef.current, eisenhower: [...cfgRef.current.eisenhower, item] });
    commit("Matrix saved.");
    setDrafts({ ...drafts, [q]: "" });
  }

  function editItem(id: string, text: string) {
    update({
      ...cfgRef.current,
      eisenhower: cfgRef.current.eisenhower.map((i) =>
        i.id === id ? { ...i, text } : i
      ),
    });
  }

  function moveItem(id: string, q: Quadrant) {
    update({
      ...cfgRef.current,
      eisenhower: cfgRef.current.eisenhower.map((i) =>
        i.id === id ? { ...i, quadrant: q } : i
      ),
    });
    commit("Moved.");
  }

  function removeItem(id: string) {
    update({
      ...cfgRef.current,
      eisenhower: cfgRef.current.eisenhower.filter((i) => i.id !== id),
    });
    commit("Removed.");
  }

  return (
    <div className="stack">
      {/* Morning block */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Protected morning block</span>
          {msg ? <span className="muted" style={{ fontSize: 12 }}>{msg}</span> : null}
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          The pre-3pm hours are the prize. Default shape, not a rigid clock. The
          point is the morning is not wasted.
        </p>
        <EditableList
          items={cfg.morningBlock}
          placeholder="Add a morning step"
          onChange={(items) => update({ ...cfgRef.current, morningBlock: items })}
          onCommit={() => commit("Morning block saved.")}
        />
      </div>

      {/* Slot when free */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Slot when free (the 3pm to 10pm window)
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Work hours are random week to week, so do not schedule into them. Keep a
          short pull-list of personal and venture tasks to grab in any gap. Pull,
          do not plan.
        </p>
        <EditableList
          items={cfg.slotWhenFree}
          placeholder="Add a slot-when-free task"
          onChange={(items) => update({ ...cfgRef.current, slotWhenFree: items })}
          onCommit={() => commit("Slot list saved.")}
        />
      </div>

      {/* Fixed rocks */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Fixed rocks
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          The genuinely fixed commitments. The morning plan works around these.
        </p>
        <EditableList
          items={cfg.fixedRocks}
          placeholder="Add a fixed commitment"
          onChange={(items) => update({ ...cfgRef.current, fixedRocks: items })}
          onCommit={() => commit("Fixed rocks saved.")}
        />
      </div>

      {/* Eisenhower matrix */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Personal Eisenhower matrix
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Life and venture ideas only. No work tasks, no ClickUp. Protect Q2, it
          is where growth lives. Move Q3 toward delegation and cut Q4.
        </p>
        {error ? (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="eisen-grid">
          {QUADRANTS.map((qd) => {
            const items = itemsInQuadrant(cfg.eisenhower, qd.q);
            return (
              <div className={`eisen-quad tone-${qd.tone}`} key={qd.q}>
                <div className="eisen-head">
                  <span className="eisen-title">
                    {qd.title} &middot; {items.length}
                  </span>
                  <span className="eisen-action">{qd.action}</span>
                </div>
                <div className="eisen-sub muted">{qd.sub}</div>

                <div className="eisen-items">
                  {items.length === 0 ? (
                    <div className="eisen-empty muted">Nothing here.</div>
                  ) : (
                    items.map((it) => (
                      <div className="eisen-item" key={it.id}>
                        <input
                          className="eisen-input"
                          value={it.text}
                          onChange={(e) => editItem(it.id, e.target.value)}
                          onBlur={() => commit("Matrix saved.")}
                        />
                        <select
                          className="eisen-move"
                          value={it.quadrant}
                          onChange={(e) =>
                            moveItem(it.id, Number(e.target.value) as Quadrant)
                          }
                          title="Move to quadrant"
                        >
                          <option value={1}>Q1</option>
                          <option value={2}>Q2</option>
                          <option value={3}>Q3</option>
                          <option value={4}>Q4</option>
                        </select>
                        <button
                          className="edit-x"
                          aria-label="Remove"
                          onClick={() => removeItem(it.id)}
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="edit-row">
                  <input
                    placeholder={`Add to ${qd.title}`}
                    value={drafts[qd.q]}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [qd.q]: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addItem(qd.q);
                    }}
                  />
                  <button
                    className="btn btn-auto"
                    onClick={() => addItem(qd.q)}
                    disabled={!drafts[qd.q]?.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
