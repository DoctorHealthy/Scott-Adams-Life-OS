"use client";

import { useState } from "react";

export default function CoachReview({
  date,
  enabled,
  hint,
}: {
  date: string;
  enabled: boolean;
  hint?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Request failed (${res.status}).`);
      } else {
        setText(json.text as string);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <div className="block-head">
        <span className="block-title">Coach</span>
        <span className="muted" style={{ fontSize: 12 }}>
          Reads your saved numbers. Never invents them.
        </span>
      </div>

      <button
        className="btn btn-primary btn-auto"
        onClick={run}
        disabled={loading || !enabled}
      >
        {loading ? "Thinking..." : text ? "Re-run review" : "Review this day"}
      </button>

      {!enabled && hint ? (
        <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {text ? <div className="coach-output">{text}</div> : null}
    </div>
  );
}
