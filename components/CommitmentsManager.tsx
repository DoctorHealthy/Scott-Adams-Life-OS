"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prettyDate, localDateStr } from "@/lib/constants";
import { weekStartOf } from "@/lib/commitments/commitments";
import NumberField from "@/components/NumberField";
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
  // The week always ends Sunday night. Show whole days remaining AFTER today
  // (daysLeft counts today), so Friday reads "2 left" and Sunday "ends today".
  const after = Math.max(0, item.daysLeft - 1);
  return (
    <span className="review-badge badge-soft">
      {after === 0 ? "ends today" : `${after} day${after > 1 ? "s" : ""} left, ends Sun`}
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
  // One picker for everything you can commit to: any system, or the wake hold.
  const WAKE = "wake";
  const [picked, setPicked] = useState<string>(systems[0]?.id ?? WAKE);
  const [target, setTarget] = useState<number>(3);
  const [toleranceMin, setToleranceMin] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Optimistic exposure toggle: flip instantly, persist behind the scenes.
  const [expose, setExpose] = useState(exposePartner);

  const isWake = picked === WAKE;
  const maxTarget = isWake ? 7 : 21;
  // Matches the action's generous backstop (was 3). Sprints are uncapped in practice.
  const canAdd = currentWeek.length < 12;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const t = Math.min(maxTarget, Math.max(1, Math.round(target) || 1));
    const input = isWake
      ? { kind: "wake_hold" as const, systemId: null, target: t, toleranceMin }
      : { kind: "system_count" as const, systemId: picked || null, target: t };
    const res = await createCommitment(input);
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  async function toggleExpose(next: boolean) {
    setExpose(next); // instant feedback; revert only if the save fails
    const res = await setExposePartner(next);
    if ("error" in res) {
      setExpose(!next);
      setError(res.error);
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
        <div className="block-title">Weekly sprints</div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          Optional one-week pushes, separate from your standing accountability
          systems. Add as many as you can actually hold.
        </p>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
          Week of {prettyDate(weekStartOf(localDateStr()))} (Monday) through Sunday.
        </p>

        {currentWeek.length === 0 ? (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
            No sprint set this week. Draw a hard line below.
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
              <label>What are you committing to?</label>
              <select
                value={picked}
                onChange={(e) => {
                  setPicked(e.target.value);
                  if (e.target.value === WAKE && target > 7) setTarget(7);
                }}
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.metric_type === "number" && s.unit ? ` (${s.unit})` : ""}
                  </option>
                ))}
                <option value={WAKE}>Wake target (hold it)</option>
              </select>
            </div>

            <div className="field">
              <label>
                {isWake ? "Days on target this week (1 to 7)" : "Times this week (1 to 21)"}
              </label>
              <NumberField
                min={1}
                max={maxTarget}
                value={target}
                placeholder="3"
                onValue={(n) => setTarget(n ?? 1)}
              />
            </div>

            {isWake ? (
              <div className="field">
                <label>Tolerance (minutes around the wake target)</label>
                <NumberField
                  min={0}
                  max={120}
                  value={toleranceMin}
                  onValue={(n) => setToleranceMin(n ?? 30)}
                />
              </div>
            ) : null}

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
            Hard lines, not a wish list.
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
            checked={expose}
            onChange={(e) => toggleExpose(e.target.checked)}
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
