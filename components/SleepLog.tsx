"use client";

import ToggleRow from "./ToggleRow";
import { targetBedtime, type SleepConfig, type SleepLog } from "@/lib/sleep/sleep";

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

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Target wake {config.currentWake} &middot; target bed {targetBedtime(config)}.
        Wake time leads. Hold it even after a bad night.
      </p>
      <div className="form-row">
        <div className="field">
          <label>Actual wake</label>
          <input
            type="time"
            value={value.wake ?? ""}
            onChange={(e) => set("wake", e.target.value || null)}
          />
        </div>
        <div className="field">
          <label>Actual bedtime</label>
          <input
            type="time"
            value={value.bed ?? ""}
            onChange={(e) => set("bed", e.target.value || null)}
          />
        </div>
      </div>
      <div className="toggle-list">
        <ToggleRow
          label="Wind-down done"
          hint="dim, prep tomorrow, read"
          on={value.windDown}
          onClick={() => set("windDown", !value.windDown)}
        />
        <ToggleRow
          label="Morning light done"
          hint="outside within 30 to 60 min of waking"
          on={value.morningLight}
          onClick={() => set("morningLight", !value.morningLight)}
        />
      </div>
    </div>
  );
}
