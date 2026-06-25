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

  return (
    <div>
      <div className="toggle-list">
        <ToggleRow
          label="Ondra warm-up done"
          hint="the daily floor, never zero"
          on={value.warmup}
          onClick={() => onChange({ ...value, warmup: !value.warmup })}
        />
        <ToggleRow
          label="Ankle prehab done"
          on={value.ankle}
          onClick={() => onChange({ ...value, ankle: !value.ankle })}
        />
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

      <p className="muted" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
        Floor is warm-up plus ankle (plus a walk). Hold it every day, even when
        you skip the session.
      </p>
    </div>
  );
}
