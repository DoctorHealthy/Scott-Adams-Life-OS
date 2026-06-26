"use client";

import { useState } from "react";

export default function AskCoach({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const res = await fetch("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      if (!res.ok) setError(json?.error || `Request failed (${res.status}).`);
      else setText(json.text as string);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        Ask the coach
      </button>
    );
  }

  const form = (
    <>
      <div className="field">
        <textarea
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="A quick question for the coach"
          autoFocus
        />
      </div>
      <button className="btn btn-primary btn-auto" onClick={ask} disabled={loading || !q.trim()}>
        {loading ? "Thinking..." : "Ask"}
      </button>
      {error ? (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      {text ? <div className="coach-output">{text}</div> : null}
    </>
  );

  // Embedded (inside a modal): no card chrome, no open/close button.
  if (embedded) return <div>{form}</div>;

  return (
    <div className="card">
      <div className="block-head">
        <span className="block-title">Ask the coach</span>
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          Close
        </button>
      </div>
      {form}
    </div>
  );
}
