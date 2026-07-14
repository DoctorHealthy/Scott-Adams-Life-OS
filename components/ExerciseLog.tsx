"use client";

import { useState } from "react";
import ToggleRow from "./ToggleRow";
import type { ExerciseConfig, ExerciseLog } from "@/lib/exercise/exercise";

export default function ExerciseLogCard({
  config,
  value,
  onChange,
}: {
  config: ExerciseConfig;
  value: ExerciseLog;
  onChange: (v: ExerciseLog) => void;
}) {
  function toggleSession() {
    const session = !value.session;
    onChange({
      ...value,
      session,
      sessionType: session ? value.sessionType : null,
    });
  }

  const tracked = config.routines.filter((r) => r.track);
  const minNames = config.routines
    .filter((r) => r.track && r.min)
    .map((r) => r.name);

  // Which routines have their item list expanded on Today (collapsed default).
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  return (
    <div>
      <div className="toggle-list">
        {tracked.map((r) => (
          <div key={r.id}>
            <ToggleRow
              label={`${r.name} done`}
              hint={r.min ? "counts toward the daily Min" : undefined}
              on={!!value.routines[r.id]}
              onClick={() =>
                onChange({
                  ...value,
                  routines: { ...value.routines, [r.id]: !value.routines[r.id] },
                })
              }
            />
            {r.items.length > 0 ? (
              <div style={{ padding: "2px 0 6px 2px" }}>
                <button
                  className="link-btn"
                  style={{ fontSize: 12 }}
                  onClick={() =>
                    setOpenItems((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                  }
                >
                  {openItems[r.id]
                    ? "Hide items"
                    : `Show items (${r.items.length})`}
                </button>
                {openItems[r.id] ? (
                  <ul
                    className="muted"
                    style={{
                      margin: "6px 0 0",
                      paddingLeft: 18,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        <ToggleRow
          label="Real session done"
          on={value.session}
          onClick={toggleSession}
        />
      </div>

      {value.session ? (
        <div className="field" style={{ marginTop: 12 }}>
          <label>Session type</label>
          <select
            value={value.sessionType ?? ""}
            onChange={(e) =>
              onChange({ ...value, sessionType: e.target.value || null })
            }
          >
            <option value="">Pick a type</option>
            {config.sessionTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {minNames.length > 0 ? (
        <p
          className="muted"
          style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}
        >
          Min is {minNames.join(" plus ")}. Hold it every day, even when you
          skip the session.
        </p>
      ) : null}
    </div>
  );
}
