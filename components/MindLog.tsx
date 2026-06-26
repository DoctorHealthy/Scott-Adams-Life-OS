"use client";

import { gemForDate } from "@/lib/mind/gems";
import type { MindLog } from "@/lib/mind/config";

export default function MindLogCard({
  date,
  value,
  onChange,
}: {
  date: string;
  value: MindLog;
  onChange: (v: MindLog) => void;
}) {
  const gem = gemForDate(date);

  return (
    <div>
      <blockquote className="gem gem-compact">
        <p className="gem-text">{gem.text}</p>
        <footer className="gem-source">
          {gem.source}
          {gem.note ? <span className="gem-note"> ({gem.note})</span> : null}
        </footer>
      </blockquote>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label>Morning intention (optional, one line)</label>
        <input
          value={value.intention ?? ""}
          onChange={(e) => onChange({ intention: e.target.value || null })}
          placeholder="Set the day's posture"
        />
      </div>
    </div>
  );
}
