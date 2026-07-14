"use client";

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

  return (
    <div>
      <div className="toggle-list">
        {tracked.map((r) => (
          <ToggleRow
            key={r.id}
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
