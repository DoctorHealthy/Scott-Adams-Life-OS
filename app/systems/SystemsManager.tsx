"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DOMAINS, METRIC_TYPES } from "@/lib/constants";
import { DOMAIN_EXAMPLES, SYSTEM_TEMPLATES } from "@/lib/systems/examples";
import type { MetricType, System } from "@/lib/types";
import NumberField from "@/components/NumberField";
import {
  createSystem,
  updateSystem,
  setSystemActive,
  deleteSystem,
  reorderSystems,
  type SystemInput,
} from "./actions";

const EMPTY: SystemInput = {
  name: "",
  domain: "Sleep",
  rule: "",
  floor: "",
  ceiling: "",
  metric_type: "binary",
  anchor: "",
  schedule_block: "",
  active: true,
  cadence: "daily",
  target_per_week: null,
  unit: null,
};

function metricLabel(m: MetricType) {
  return METRIC_TYPES.find((x) => x.value === m)?.label ?? m;
}

export default function SystemsManager({
  initialSystems,
}: {
  initialSystems: System[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SystemInput>(EMPTY);
  const [templateKey, setTemplateKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const active = initialSystems.filter((s) => s.active);
  const archived = initialSystems.filter((s) => !s.active);

  // Placeholders track the selected domain live. Hints only, never saved values.
  const ex = DOMAIN_EXAMPLES[form.domain] ?? DOMAIN_EXAMPLES.Custom;

  async function move(index: number, dir: "up" | "down") {
    const ids = active.map((s) => s.id);
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setReordering(true);
    const res = await reorderSystems(ids);
    setReordering(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setTemplateKey("");
    setError(null);
    setOpen(true);
  }

  function openEdit(s: System) {
    setEditingId(s.id);
    setForm({
      name: s.name ?? "",
      domain: s.domain ?? "Custom",
      rule: s.rule ?? "",
      floor: s.floor ?? "",
      ceiling: s.ceiling ?? "",
      metric_type: s.metric_type,
      anchor: s.anchor ?? "",
      schedule_block: s.schedule_block ?? "",
      active: s.active,
      cadence: s.cadence ?? "daily",
      target_per_week: s.target_per_week ?? null,
      unit: s.unit ?? null,
    });
    setTemplateKey("");
    setError(null);
    setOpen(true);
  }

  // Fill the whole create form from a template. Real values, editable before save.
  function applyTemplate(key: string) {
    setTemplateKey(key);
    const t = SYSTEM_TEMPLATES.find((x) => x.key === key);
    if (!t) {
      setForm(EMPTY);
      return;
    }
    setForm({
      ...EMPTY,
      name: t.values.name,
      domain: t.values.domain,
      rule: t.values.rule,
      floor: t.values.floor,
      ceiling: t.values.ceiling,
      metric_type: t.values.metric_type,
      anchor: t.values.anchor,
      cadence: t.values.cadence,
      target_per_week: t.values.target_per_week,
      unit: t.values.unit,
    });
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = editingId
      ? await updateSystem(editingId, form)
      : await createSystem(form);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function toggleActive(s: System) {
    setBusyId(s.id);
    await setSystemActive(s.id, !s.active);
    setBusyId(null);
    router.refresh();
  }

  async function remove(s: System) {
    if (
      !window.confirm(
        `Delete "${s.name}" permanently? This cannot be undone. To keep its history, pause it instead.`
      )
    )
      return;
    setBusyId(s.id);
    await deleteSystem(s.id);
    setBusyId(null);
    router.refresh();
  }

  function card(s: System, index?: number, total?: number) {
    const sortable = index !== undefined && total !== undefined;
    return (
      <div className="system-card" key={s.id}>
        <div className="system-head">
          <span className={`badge domain-${(s.domain ?? "custom").toLowerCase().replace(/\s+/g, "-")}`}>
            {s.domain ?? "Custom"}
          </span>
          <span className="badge badge-soft">{metricLabel(s.metric_type)}</span>
          {sortable ? (
            <div className="sort-arrows">
              <button
                className="sort-arrow"
                onClick={() => move(index, "up")}
                disabled={reordering || index === 0}
                title="Move up"
                aria-label="Move up"
              >
                &uarr;
              </button>
              <button
                className="sort-arrow"
                onClick={() => move(index, "down")}
                disabled={reordering || index === (total ?? 1) - 1}
                title="Move down"
                aria-label="Move down"
              >
                &darr;
              </button>
            </div>
          ) : null}
        </div>
        <Link href={`/systems/${s.id}`} className="system-name-link">
          {s.name}
        </Link>
        {s.rule ? <div className="system-rule">{s.rule}</div> : null}

        <div className="system-meta">
          {s.floor ? (
            <div>
              <span className="meta-k">Floor</span>
              <span>{s.floor}</span>
            </div>
          ) : null}
          {s.ceiling ? (
            <div>
              <span className="meta-k">Ceiling</span>
              <span>{s.ceiling}</span>
            </div>
          ) : null}
          {s.anchor ? (
            <div>
              <span className="meta-k">Anchor</span>
              <span>{s.anchor}</span>
            </div>
          ) : null}
          {s.schedule_block ? (
            <div>
              <span className="meta-k">When</span>
              <span>{s.schedule_block}</span>
            </div>
          ) : null}
        </div>

        <div className="system-actions">
          <Link href={`/systems/${s.id}`} className="btn btn-ghost btn-auto">
            Playbook
          </Link>
          <button className="btn btn-ghost" onClick={() => openEdit(s)}>
            Edit
          </button>
          <button
            className="btn btn-ghost"
            disabled={busyId === s.id}
            onClick={() => toggleActive(s)}
          >
            {s.active ? "Pause" : "Resume"}
          </button>
          <button
            className="btn btn-ghost btn-danger"
            disabled={busyId === s.id}
            onClick={() => remove(s)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Systems engine</div>
          <h1 style={{ marginTop: 6 }}>Your systems</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: 560 }}>
            A system is a behavior you repeat, not an outcome you chase. Give each
            one a floor (the bad-day version that still counts) and a ceiling.
          </p>
        </div>
        <button className="btn btn-primary btn-auto" onClick={openCreate}>
          New system
        </button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className="card empty">
          <p>No systems yet. Build your first one.</p>
          <button className="btn btn-primary btn-auto" onClick={openCreate}>
            New system
          </button>
        </div>
      ) : null}

      {active.length > 0 ? (
        <div>
          <div className="section-label">
            Active <span className="muted">- arrows set the order on the check-in</span>
          </div>
          <div className="system-grid">
            {active.map((s, i) => card(s, i, active.length))}
          </div>
        </div>
      ) : null}

      {archived.length > 0 ? (
        <div>
          <div className="section-label">
            Paused <span className="muted">- not counted anywhere until you resume</span>
          </div>
          <div className="system-grid">{archived.map((s) => card(s))}</div>
        </div>
      ) : null}

      {open ? (
        <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ fontSize: 18, margin: 0 }}>
                {editingId ? "Edit system" : "New system"}
              </h2>
              <button
                className="btn btn-ghost btn-auto"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Close
              </button>
            </div>

            {error ? <div className="alert alert-error">{error}</div> : null}

            {!editingId ? (
              <div className="field">
                <label>Start from a template</label>
                <select
                  value={templateKey}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">Blank (build your own)</option>
                  {SYSTEM_TEMPLATES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="muted" style={{ fontSize: 12 }}>
                  Fills the form with a ready-made system you can edit before
                  saving.
                </span>
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
              These fields are your contract. You see them on Today; the coach
              reads them in every review.
            </p>

            <div className="field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Wake at target time"
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label>Domain</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>What you log</label>
                <select
                  value={form.metric_type}
                  onChange={(e) =>
                    setForm({ ...form, metric_type: e.target.value as MetricType })
                  }
                >
                  {METRIC_TYPES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Cadence</label>
                <select
                  value={form.cadence}
                  onChange={(e) => {
                    const cadence = e.target.value === "weekly" ? "weekly" : "daily";
                    setForm({
                      ...form,
                      cadence,
                      target_per_week:
                        cadence === "weekly" ? form.target_per_week ?? 3 : null,
                    });
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              {form.cadence === "weekly" ? (
                <div className="field">
                  <label>Times per week</label>
                  <NumberField
                    min={1}
                    max={21}
                    value={form.target_per_week}
                    placeholder="3"
                    onValue={(n) =>
                      setForm({ ...form, target_per_week: n ?? 3 })
                    }
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    Judged over the week, not the day. No daily nagging.
                  </span>
                </div>
              ) : null}
            </div>

            {form.metric_type === "number" ? (
              <div className="field">
                <label>Unit</label>
                <input
                  value={form.unit ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, unit: e.target.value || null })
                  }
                  placeholder="e.g. touches, pages, calls"
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  You bump this counter on Today; the weekly total is judged
                  against your target.
                </span>
              </div>
            ) : null}

            <div className="field">
              <label>Rule (the behavior you repeat)</label>
              <input
                value={form.rule}
                onChange={(e) => setForm({ ...form, rule: e.target.value })}
                placeholder={ex.rule}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                The behavior you repeat. The coach holds you to this.
              </span>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Min (bad-day version)</label>
                <input
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder={ex.floor}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  The smallest version that still counts on your worst day.
                  Protects the streak.
                </span>
              </div>
              <div className="field">
                <label>Ceiling (full version)</label>
                <input
                  value={form.ceiling}
                  onChange={(e) => setForm({ ...form, ceiling: e.target.value })}
                  placeholder={ex.ceiling}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  The full version when energy is high.
                </span>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Anchor (what it attaches to)</label>
                <input
                  value={form.anchor}
                  onChange={(e) => setForm({ ...form, anchor: e.target.value })}
                  placeholder={ex.anchor}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  The existing moment or habit this attaches to. The coach uses
                  it to place the habit in your day.
                </span>
              </div>
              <div className="field">
                <label>When (schedule block)</label>
                <input
                  value={form.schedule_block}
                  onChange={(e) =>
                    setForm({ ...form, schedule_block: e.target.value })
                  }
                  placeholder="Morning, on waking"
                />
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span>Active (shows in the daily check-in)</span>
            </label>

            <div className="btn-row" style={{ marginTop: 18 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Create system"}
              </button>
              <button
                className="btn"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
