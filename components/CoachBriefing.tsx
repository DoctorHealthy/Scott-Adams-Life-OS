"use client";

import { useEffect, useRef, useState } from "react";

// The coach's morning greeting. Auto-runs once per day (cached in sessionStorage
// so re-opening Today does not burn a call). The structured plan renders
// separately in code; this is just the voice on top.
export default function CoachBriefing({ date }: { date: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ranFor = useRef<string | null>(null);

  async function run(force = false) {
    setLoading(true);
    setError(null);
    const cacheKey = `briefing:${date}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setText(cached);
          setLoading(false);
          return;
        }
      } catch {
        // sessionStorage may be unavailable; ignore and fetch.
      }
    }
    try {
      const res = await fetch("/api/coach/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json?.busy
            ? "Coach is busy right now."
            : json?.error || `Request failed (${res.status}).`
        );
      } else {
        setText(json.text as string);
        try {
          sessionStorage.setItem(cacheKey, json.text);
        } catch {
          // ignore
        }
      }
    } catch {
      setError("Coach is busy right now.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (ranFor.current !== date) {
      ranFor.current = date;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="briefing">
      {loading ? (
        <p className="muted" style={{ margin: 0 }}>
          Coach is reading your plan...
        </p>
      ) : null}
      {error ? (
        <p className="muted" style={{ margin: 0 }}>
          {error}{" "}
          <button className="link-btn" onClick={() => run(true)}>
            Retry
          </button>
        </p>
      ) : null}
      {text ? <div className="briefing-text">{text}</div> : null}
    </div>
  );
}
