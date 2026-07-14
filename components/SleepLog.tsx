"use client";

import ToggleRow from "./ToggleRow";
import { targetBedtime, type SleepConfig, type SleepLog } from "@/lib/sleep/sleep";

// The sleep log records what actually happened: this morning's wake and LAST
// night's bedtime. Fields start empty (targets are placeholders only) so a
// saved day never fabricates adherence; the hold streak counts real wakes only.
export default function SleepLogCard({
  config,
  value,
  onChange,
}: {
  config: SleepConfig;
  value: SleepLog;
  onChange: (v: SleepLog) => void;
}) {
  function set<K extends keyof SleepLog>(k: K, v: SleepLog[K]) {
    onChange({ ...value, [k]: v });
  }

  const bedTarget = targetBedtime(config);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Wake time leads. Hold it even after a bad night.
      </p>
      <div className="form-row">
        <div className="field">
          <label>When did you wake up today?</label>
          <input
            type="time"
            value={value.wake ?? ""}
            placeholder={config.currentWake}
            onChange={(e) => set("wake", e.target.value || null)}
          />
          {value.wake == null ? (
            <button
              className="link-btn"
              style={{ marginTop: 6 }}
              onClick={() => set("wake", config.currentWake)}
            >
              Woke on target ({config.currentWake})
            </button>
          ) : null}
        </div>
        <div className="field">
          <label>When did you go to bed last night?</label>
          <input
            type="time"
            value={value.bed ?? ""}
            placeholder={bedTarget}
            onChange={(e) => set("bed", e.target.value || null)}
          />
          {value.bed == null ? (
            <button
              className="link-btn"
              style={{ marginTop: 6 }}
              onClick={() => set("bed", bedTarget)}
            >
              In bed on target ({bedTarget})
            </button>
          ) : null}
        </div>
      </div>
      <div className="toggle-list">
        <ToggleRow
          label="Morning light done"
          hint="outside within 30 to 60 min of waking"
          on={value.morningLight}
          onClick={() => set("morningLight", !value.morningLight)}
        />
        <ToggleRow
          label="Wind-down done"
          hint="dim, prep tomorrow, read"
          on={value.windDown}
          onClick={() => set("windDown", !value.windDown)}
        />
      </div>
    </div>
  );
}
