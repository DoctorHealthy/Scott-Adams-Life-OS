"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrendChart from "@/components/TrendChart";
import { minToHHMM } from "@/lib/sleep/sleep";
import { setTrendMetrics } from "@/app/trends/actions";
import type { MetricGroup, Point, SeriesPayload } from "@/lib/trends/trends";

const GROUP_ORDER: MetricGroup[] = ["Core", "Sleep", "Diet", "Systems", "Goals"];

function tail(points: Point[], days: number): Point[] {
  return points.slice(-days);
}

export default function TrendsView({
  allSeries,
  initialSelected,
}: {
  allSeries: SeriesPayload[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const [days, setDays] = useState<30 | 90>(30);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const byKey = useMemo(
    () => new Map(allSeries.map((s) => [s.key, s])),
    [allSeries]
  );
  const selectedSeries = selected
    .map((k) => byKey.get(k))
    .filter((s): s is SeriesPayload => !!s);
  const availableToAdd = allSeries.filter((s) => !selected.includes(s.key));

  function persist(next: string[]) {
    setSelected(next);
    void setTrendMetrics(next).then(() => router.refresh());
  }
  function remove(key: string) {
    persist(selected.filter((k) => k !== key));
  }
  function add(key: string) {
    persist([...selected, key]);
  }
  function move(key: string, dir: -1 | 1) {
    const i = selected.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  return (
    <div className="stack">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              className={`btn btn-auto${days === d ? " btn-primary" : ""}`}
              onClick={() => setDays(d)}
            >
              {d} days
            </button>
          ))}
        </div>
        <button className="btn btn-auto" onClick={() => setEditing((e) => !e)}>
          {editing ? "Done" : "Edit trends"}
        </button>
      </div>

      {editing ? (
        <div className="card">
          <div className="block-title">Showing</div>
          {selectedSeries.length === 0 ? (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
              None selected. Add trends below.
            </p>
          ) : (
            <div className="review-rows">
              {selectedSeries.map((s, i) => (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14 }}>{s.label}</span>
                  <button
                    className="btn btn-ghost btn-auto"
                    onClick={() => move(s.key, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost btn-auto"
                    onClick={() => move(s.key, 1)}
                    disabled={i === selectedSeries.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-auto btn-danger"
                    onClick={() => remove(s.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableToAdd.length > 0 ? (
            <>
              <div className="block-title" style={{ marginTop: 16 }}>
                Add a trend
              </div>
              {GROUP_ORDER.map((group) => {
                const inGroup = availableToAdd.filter((s) => s.group === group);
                if (inGroup.length === 0) return null;
                return (
                  <div key={group} style={{ marginTop: 10 }}>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginBottom: 6 }}
                    >
                      {group}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {inGroup.map((s) => (
                        <button
                          key={s.key}
                          className="btn btn-auto"
                          onClick={() => add(s.key)}
                        >
                          + {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      ) : null}

      {selectedSeries.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            No trends selected. Tap Edit trends to add some.
          </p>
        </div>
      ) : (
        selectedSeries.map((s) => (
          <TrendChart
            key={s.key}
            title={s.label}
            points={tail(s.points, days)}
            unit={s.unit}
            target={s.target ?? undefined}
            targetLabel={s.targetLabel}
            yMinHint={s.yMinHint}
            yMaxHint={s.yMaxHint}
            formatValue={s.isTime ? (v) => minToHHMM(v) : undefined}
            summary={s.summary}
          />
        ))
      )}
    </div>
  );
}
