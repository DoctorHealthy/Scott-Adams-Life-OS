"use client";

import { useState } from "react";
import Link from "next/link";
import { localDateStr } from "@/lib/constants";
import { gemForDate } from "@/lib/mind/gems";
import { reframesByCategory, REFRAMES } from "@/lib/mind/reframes";
import { saveMindConfig, } from "@/app/mind/actions";
import type { MindConfig } from "@/lib/mind/config";

export default function MindPlaybook({ config }: { config: MindConfig }) {
  const [vision, setVision] = useState(config.vision);
  const [pinned, setPinned] = useState<string[]>(config.pinnedReframes);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gem = gemForDate(localDateStr());
  const pinnedSet = new Set(pinned);

  async function persist(next: MindConfig, message: string) {
    setSaving(true);
    setError(null);
    const res = await saveMindConfig(next);
    setSaving(false);
    if ("error" in res) setError(res.error);
    else setMsg(message);
  }

  function saveVision() {
    persist({ vision: vision.trim() || config.vision, pinnedReframes: pinned }, "Vision saved.");
  }

  function togglePin(id: string) {
    const next = pinnedSet.has(id)
      ? pinned.filter((x) => x !== id)
      : [...pinned, id];
    setPinned(next);
    persist({ vision, pinnedReframes: next }, "Saved.");
  }

  const pinnedReframes = REFRAMES.filter((r) => pinnedSet.has(r.id));

  return (
    <div className="stack">
      {/* Vision */}
      <div className="card">
        <div className="card-head-row">
          <span className="eyebrow">Future vision (pinned)</span>
          {msg ? <span className="muted" style={{ fontSize: 12 }}>{msg}</span> : null}
        </div>
        <textarea
          rows={3}
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          placeholder="Where you are going. Keep it sharp, not an essay."
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-auto" onClick={saveVision} disabled={saving}>
            Save vision
          </button>
        </div>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* Daily gem */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Today&apos;s gem
        </div>
        <blockquote className="gem">
          <p className="gem-text">{gem.text}</p>
          <footer className="gem-source">
            {gem.source}
            {gem.note ? <span className="gem-note"> ({gem.note})</span> : null}
          </footer>
        </blockquote>
      </div>

      {/* Intention + reflection framing */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Intention and reflection
        </div>
        <p style={{ marginTop: 0, lineHeight: 1.55 }}>
          Morning intention, one line, optional: set the day&apos;s posture. Expect
          friction, stay locked in, work the system. Evening, reflect on three
          things: what moved you forward, what pulled you off, the one adjustment.
        </p>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          Log the morning intention and the evening reflection in your{" "}
          <Link href="/checkin" className="link">
            daily check-in
          </Link>
          .
        </p>
      </div>

      {/* Reframe library */}
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Reframe library
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Swap a thought that drains you for one that moves you. The coach offers
          one when your check-in words go negative. Pin the ones you want close.
        </p>

        {pinnedReframes.length > 0 ? (
          <div className="reframe-group">
            <div className="reframe-cat">Pinned</div>
            {pinnedReframes.map((r) => (
              <div className="reframe-row" key={`p-${r.id}`}>
                <div className="reframe-text">
                  <span className="reframe-old">{r.old}</span>
                  <span className="reframe-arrow"> &rarr; </span>
                  <span className="reframe-new">{r.next}</span>
                </div>
                <button
                  className="pin-btn on"
                  onClick={() => togglePin(r.id)}
                  disabled={saving}
                >
                  Pinned
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {reframesByCategory().map((g) => (
          <div className="reframe-group" key={g.category}>
            <div className="reframe-cat">{g.category}</div>
            {g.items.map((r) => (
              <div className="reframe-row" key={r.id}>
                <div className="reframe-text">
                  <span className="reframe-old">{r.old}</span>
                  <span className="reframe-arrow"> &rarr; </span>
                  <span className="reframe-new">{r.next}</span>
                  {r.verified ? null : (
                    <span className="reframe-tag muted"> derived</span>
                  )}
                </div>
                <button
                  className={`pin-btn${pinnedSet.has(r.id) ? " on" : ""}`}
                  onClick={() => togglePin(r.id)}
                  disabled={saving}
                >
                  {pinnedSet.has(r.id) ? "Pinned" : "Pin"}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
