"use client";

import { useState } from "react";
import Link from "next/link";
import { prettyDate, STATUS_META } from "@/lib/constants";
import type { SystemStatus } from "@/lib/types";

type SysMini = {
  id: string;
  name: string;
  domain: string | null;
  active: boolean;
};

type LastEntry = {
  date: string;
  energy_1_10: number | null;
  one_line: string | null;
  reflection: string | null;
  tomorrow_next_action: string | null;
  system_statuses: Record<string, SystemStatus>;
};

export default function LastEntryCard({
  entry,
  systems,
}: {
  entry: LastEntry | null;
  systems: SysMini[];
}) {
  const [open, setOpen] = useState(false);

  if (!entry) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Nothing logged yet. Your first{" "}
        <Link href="/checkin" className="link">
          check-in
        </Link>{" "}
        starts the record.
      </p>
    );
  }

  const statuses = entry.system_statuses ?? {};

  // Show every active system plus anything that was logged that day
  // (covers systems archived or deleted after the entry was made).
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
    <div>
      <button
        className="entry-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="muted">{prettyDate(entry.date)}</span>
        <span className="energy-pill">Energy {entry.energy_1_10 ?? "--"}/10</span>
        {!open && entry.one_line ? (
          <span className="entry-preview">{entry.one_line}</span>
        ) : null}
        <span className="entry-chevron">{open ? "Hide" : "Show full entry"}</span>
      </button>

      {open ? (
        <div className="entry-detail">
          <div className="detail-block">
            <div className="detail-label">One line</div>
            <div>{entry.one_line || <span className="muted">Not logged.</span>}</div>
          </div>

          <div className="detail-block">
            <div className="detail-label">Evening reflection</div>
            <div className="detail-body">
              {entry.reflection || <span className="muted">Not logged.</span>}
            </div>
          </div>

          <div className="detail-block">
            <div className="detail-label">Tomorrow&apos;s next action</div>
            <div>
              {entry.tomorrow_next_action || (
                <span className="muted">Not logged.</span>
              )}
            </div>
          </div>

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
