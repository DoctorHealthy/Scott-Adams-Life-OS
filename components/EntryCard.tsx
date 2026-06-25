"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prettyDate, STATUS_META } from "@/lib/constants";
import type { SystemStatus } from "@/lib/types";
import { deleteEntry } from "@/app/checkin/actions";

export type SysMini = {
  id: string;
  name: string;
  domain: string | null;
  active: boolean;
};

export type EntryRow = {
  date: string;
  energy_1_10: number | null;
  one_line: string | null;
  reflection: string | null;
  tomorrow_next_action: string | null;
  system_statuses: Record<string, SystemStatus>;
};

function Field({
  label,
  value,
  body,
}: {
  label: string;
  value: string | null;
  body?: boolean;
}) {
  return (
    <div className="detail-block">
      <div className="detail-label">{label}</div>
      <div className={body ? "detail-body" : undefined}>
        {value ? value : <span className="muted">Not logged.</span>}
      </div>
    </div>
  );
}

export default function EntryCard({
  entry,
  systems,
}: {
  entry: EntryRow;
  systems: SysMini[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (
      !window.confirm(
        `Delete the check-in for ${prettyDate(entry.date)}? This removes that day's row and cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    const res = await deleteEntry(entry.date);
    setDeleting(false);
    if ("error" in res) {
      window.alert(`Could not delete: ${res.error}`);
      return;
    }
    router.refresh();
  }

  const statuses = entry.system_statuses ?? {};

  // Every active system plus anything logged that day (so renamed, archived,
  // or deleted systems still resolve to a sensible label).
  const ids = Array.from(
    new Set([
      ...systems.filter((s) => s.active).map((s) => s.id),
      ...Object.keys(statuses),
    ])
  );

  const rows = ids.map((id) => {
    const sys = systems.find((s) => s.id === id);
    return {
      id,
      name: sys?.name ?? "Deleted system",
      status: (statuses[id] ?? null) as SystemStatus | null,
    };
  });

  return (
    <div className="entry-item">
      <div className="entry-item-top">
        <button
          className="entry-item-head"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <div className="entry-line1">
            <span className="entry-date">{prettyDate(entry.date)}</span>
            <span className="energy-pill">
              Energy {entry.energy_1_10 ?? "--"}/10
            </span>
            <span className="entry-chevron">{open ? "Hide" : "Open"}</span>
          </div>
          {!open ? (
            <div className="entry-oneline">
              {entry.one_line ? (
                entry.one_line
              ) : (
                <span className="muted">No one-line logged.</span>
              )}
            </div>
          ) : null}
        </button>
        <button
          className="entry-del"
          onClick={remove}
          disabled={deleting}
          title="Delete this check-in"
        >
          {deleting ? "..." : "Delete"}
        </button>
      </div>

      {open ? (
        <div className="entry-detail">
          <Field label="One line" value={entry.one_line} />
          <Field label="Evening reflection" value={entry.reflection} body />
          <Field
            label="Tomorrow's next action"
            value={entry.tomorrow_next_action}
          />

          <div className="detail-block">
            <div className="detail-label">Systems</div>
            {rows.length === 0 ? (
              <span className="muted">No systems logged.</span>
            ) : (
              <div className="detail-systems">
                {rows.map((r) => (
                  <div className="sys-status-row" key={r.id}>
                    <span className="sys-status-name">{r.name}</span>
                    <span className={`statchip ${r.status ?? "none"}`}>
                      {r.status ? STATUS_META[r.status].label : "Not logged"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
