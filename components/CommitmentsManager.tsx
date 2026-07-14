"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prettyDate } from "@/lib/constants";
import {
  createCommitment,
  deleteCommitment,
  setExposePartner,
} from "@/app/commitments/actions";

export type CommitmentItem = {
  id: string;
  week_start: string;
  label: string;
  status: "active" | "passed" | "failed";
  count: number;
  target: number;
  daysLeft: number;
  debrief: boolean;
};

type PickerSystem = {
  id: string;
  name: string;
  metric_type: string;
  unit: string | null;
};

function StatusChip({ item }: { item: CommitmentItem }) {
  if (item.status === "passed")
    return <span className="review-badge badge-autopilot">PASSED</span>;
  if (item.status === "failed")
    return <span className="review-badge badge-attention">FAILED</span>;
  return (
    <span className="review-badge badge-soft">
      {item.daysLeft} d left
    </span>
  );
}

function ProgressBar({ count, target }: { count: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  return (
    <div
      style={{
        flex: 1,
        height: 6,
        borderRadius: 999,
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--accent)",
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

export default function CommitmentsManager({
  currentWeek,
  past,
  systems,
  exposePartner,
}: {
  currentWeek: CommitmentItem[];
  past: CommitmentItem[];
  systems: PickerSystem[];
  exposePartner: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"system_count" | "wake_hold">(
    "system_count"
  );
  const [systemId, setSystemId] = useState<string>(systems[0]?.id ?? "");
  const [systemTarget, setSystemTarget] = useState(3);
  const [wakeDays, setWakeDays] = useState(5);
  const [toleranceMin, setToleranceMin] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canAdd = currentWeek.length < 3;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const input =
      kind === "wake_hold"
        ? { kind, systemId: null, target: wakeDays, toleranceMin }
        : { kind, systemId: systemId || null, target: systemTarget };
    const res = await createCommitment(input);
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (
      !confirm(
        "Remove this commitment? Only this week's active ones can be removed."
      )
    )
      return;
    setError(null);
    const res = await deleteCommitment(id);
    if ("error" in res) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="block-title">This week&apos;s commitments (max 3)</div>

        {currentWeek.length === 0 ? (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
            No commitment set this week. Draw a hard line below.
          </p>
        ) : (
          <div className="review-rows">
            {currentWeek.map((c, i) => (
              <div
                key={c.id}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    i === currentWeek.length - 1
                      ? "none"
                      : "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {c.label}
                  </span>
                  <StatusChip item={c} />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  <ProgressBar count={c.count} target={c.target} />
                  <span
                    className="muted"
                    style={{
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.count}/{c.target}
                  </span>
                </div>
                {c.status === "active" ? (
                  <button
                    className="btn btn-ghost btn-auto btn-danger"
                    style={{ fontSize: 12, padding: "5px 10px", marginTop: 10 }}
                    onClick={() => remove(c.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {canAdd ? (
          <form onSubmit={add} style={{ marginTop: 18 }}>
            <div className="field">
              <label>Commitment type</label>
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "system_count" | "wake_hold")
                }
              >
                <option value="system_count">A system happens N times</option>
                <option value="wake_hold">Hold the wake target N days</option>
              </select>
            </div>

            {kind === "system_count" ? (
              <>
                <div className="field">
                  <label>System</label>
                  <select
                    value={systemId}
                    onChange={(e) => setSystemId(e.target.value)}
                  >
                    {systems.length === 0 ? (
                      <option value="">No systems yet</option>
                    ) : (
                      systems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Times this week (1 to 21)</label>
                  <input
                    type="number"
                    min={1}
                    max={21}
                    value={systemTarget}
                    onChange={(e) => setSystemTarget(Number(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Days (1 to 7)</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={wakeDays}
                    onChange={(e) => setWakeDays(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Tolerance (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={toleranceMin}
                    onChange={(e) => setToleranceMin(Number(e.target.value))}
                  />
                </div>
              </>
            )}

            {error ? (
              <div className="alert alert-error">{error}</div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary btn-auto"
              disabled={submitting}
            >
              {submitting ? "Setting..." : "Set commitment"}
            </button>
          </form>
        ) : (
          <p className="muted" style={{ margin: "16px 0 0", fontSize: 13 }}>
            Three commitments a week, maximum. Hard lines, not a wish list.
          </p>
        )}

        {!canAdd && error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="divider" style={{ margin: "18px 0" }} />

        <label className="check-row">
          <input
            type="checkbox"
            checked={exposePartner}
            onChange={async (e) => {
              await setExposePartner(e.target.checked);
              router.refresh();
            }}
          />
          Expose broken commitments to my partner on Telegram
        </label>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
          Your partner gets a message when you break one. That is the point.
        </p>
      </div>

      {past.length > 0 ? (
        <div className="card">
          <div className="block-title">History</div>
          <div className="review-rows">
            {past.map((c) => (
              <div className="review-row" key={c.id}>
                <span className="rk">
                  week of {prettyDate(c.week_start)}: {c.label}
                </span>
                <span className="rv">
                  {c.status.toUpperCase()} ({c.count}/{c.target})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
