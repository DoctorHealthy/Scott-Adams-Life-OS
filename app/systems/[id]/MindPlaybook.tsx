"use client";

import { useState } from "react";
import Link from "next/link";
import { reframesByCategory, REFRAMES, type Reframe } from "@/lib/mind/reframes";
import { saveMindConfig } from "@/app/mind/actions";
import type { MindConfig } from "@/lib/mind/config";

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4h6l-1 5 3 2.5V13H7v-1.5L10 9 9 4z" />
      <line x1="12" y1="13" x2="12" y2="20" />
    </svg>
  );
}

export default function MindPlaybook({ config }: { config: MindConfig }) {
  const [vision, setVision] = useState(config.vision);
  const [pinned, setPinned] = useState<string[]>(config.pinnedReframes);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const card = (r: Reframe, isPinned: boolean, showCategory: boolean) => (
    <div className={`reframe-card${isPinned ? " pinned" : ""}`} key={(isPinned ? "p-" : "") + r.id}>
      <div className="reframe-text">
        <span className="reframe-old">{r.old}</span>
        <span className="reframe-arrow"> &rarr; </span>
        <span className="reframe-new">{r.next}</span>
        {showCategory || !r.verified ? (
          <div className="reframe-meta">
            {showCategory ? <span className="reframe-chip">{r.category}</span> : null}
            {r.verified ? (
              showCategory ? <span className="reframe-chip">Adams</span> : null
            ) : (
              <span className="reframe-chip">derived</span>
            )}
          </div>
        ) : null}
      </div>
      <button
        className="pin-icon-btn"
        aria-label={isPinned ? "Unpin" : "Pin"}
        aria-pressed={isPinned}
        onClick={() => togglePin(r.id)}
        disabled={saving}
        style={{ color: isPinned ? "var(--accent)" : "var(--muted)" }}
      >
        <PinIcon filled={isPinned} />
      </button>
    </div>
  );

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
          Log the morning intention and the evening reflection in the Mind row on{" "}
          <Link href="/today" className="link">
            Today
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
            <div className="reframe-list">
              {pinnedReframes.map((r) => card(r, true, true))}
            </div>
          </div>
        ) : null}

        {reframesByCategory().map((g) => {
          const items = g.items.filter((r) => !pinnedSet.has(r.id));
          if (items.length === 0) return null;
          return (
            <div className="reframe-group" key={g.category}>
              <div className="reframe-cat">{g.category}</div>
              <div className="reframe-list">
                {items.map((r) => card(r, false, false))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
