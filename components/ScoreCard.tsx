"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { localDateStr, prettyDate } from "@/lib/constants";
import { dayGradeTone, weekGradeTone } from "@/lib/score/score";
import { eur, type ScoreConfig } from "@/lib/score/config";
import type { ScoreState } from "@/lib/score/state";
import {
  enableScoring,
  disableScoring,
  setScoreSettings,
  declareException,
  removeException,
  liftLock,
  resetAccountability,
  addManualLedger,
  markLedgerDone,
  waiveLedger,
  logPayout,
  type ScoreSettingsInput,
} from "@/app/score/actions";

type Tone = "green" | "yellow" | "red" | "black";
type ActionResult = { ok: true } | { error: string };
type PickSystem = { id: string; name: string };

const TONE_COLOR: Record<Tone, string> = {
  green: "var(--good)",
  yellow: "var(--warn)",
  red: "var(--bad)",
  black: "var(--text)",
};

// Numeric fields are kept as strings so typing (clear, retype) is never fought;
// they resolve to a number only on submit, falling back to the current value.
function numOr(s: string, fallback: number): number {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------

export default function ScoreCard({
  state,
  systems,
  today,
}: {
  state: ScoreState;
  systems: PickSystem[];
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible sections. Everything but the summary stays folded by default.
  const [showFund, setShowFund] = useState(false);
  const [showManualFine, setShowManualFine] = useState(false);
  const [showEx, setShowEx] = useState(false);
  const [showAllEx, setShowAllEx] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Setup (scoring off) selection.
  const [setupIds, setSetupIds] = useState<string[]>(systems.map((s) => s.id));

  // Fund controls.
  const [fundName, setFundName] = useState(state.fund.name);
  const [fundTarget, setFundTarget] = useState(
    state.fund.targetEur != null ? String(state.fund.targetEur) : ""
  );
  const [payoutAmt, setPayoutAmt] = useState("");
  const [payoutLabel, setPayoutLabel] = useState("");

  // Manual fine.
  const [mfAmt, setMfAmt] = useState("");
  const [mfLabel, setMfLabel] = useState("");

  // Exceptions are date ranges now. A single day is the same date twice.
  const [exFrom, setExFrom] = useState(localDateStr());
  const [exTo, setExTo] = useState(localDateStr());
  const [exReason, setExReason] = useState("");

  async function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    setBusy(true);
    try {
      const res = await fn();
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSetup(id: string) {
    setSetupIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  // ---- setup card (scoring off) ----------------------------------------
  if (!state.enabled) {
    return (
      <div className="card">
        <div className="eyebrow">Accountability</div>
        <div className="block-title" style={{ marginTop: 6 }}>
          Score your days
        </div>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
          Each selected system is worth 1 point per day. The day is judged after
          your cutoff, then graded, and a bad day costs you.
        </p>

        {systems.length === 0 ? (
          <p className="muted" style={{ margin: "16px 0 0", fontSize: 13 }}>
            Build a system or two first, then come back to switch scoring on.
          </p>
        ) : (
          <>
            <div style={{ marginTop: 16 }}>
              {systems.map((s) => (
                <label className="check-row" key={s.id}>
                  <input
                    type="checkbox"
                    checked={setupIds.includes(s.id)}
                    onChange={() => toggleSetup(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>

            {error ? (
              <div className="alert alert-error" style={{ marginTop: 14 }}>
                {error}
              </div>
            ) : null}

            <button
              className="btn btn-primary btn-auto"
              style={{ marginTop: 16 }}
              disabled={busy || setupIds.length === 0}
              onClick={() => run(() => enableScoring(today, setupIds))}
            >
              {busy ? "Enabling..." : "Enable scoring"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ---- live card (scoring on) ------------------------------------------
  const { week, weekProjection, todayScore, todayGrade, lock, fund } = state;
  const weekColor = TONE_COLOR[weekGradeTone(weekProjection) as Tone];
  const todayColor = TONE_COLOR[dayGradeTone(todayGrade) as Tone];

  // Exceptions, most-recent-first. Collapse past the first five so a long list
  // never stacks up.
  const sortedExceptions = [...state.config.exceptions].sort((a, b) =>
    a.from < b.from ? 1 : a.from > b.from ? -1 : 0
  );
  const shownExceptions = showAllEx ? sortedExceptions : sortedExceptions.slice(0, 5);

  return (
    <div className="card">
      <div className="eyebrow">Accountability</div>

      {/* header: this week + projected grade */}
      <div className="card-head-row" style={{ marginTop: 6, marginBottom: 0 }}>
        <span className="block-title">This week</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            className="muted"
            style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}
          >
            {week.points}/{week.max}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: weekColor }}>
            {weekProjection}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            projected
          </span>
        </span>
      </div>

      {!state.hasScoredSystems ? (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          No scored systems right now. Pick some under Settings below.
        </p>
      ) : null}

      {/* day strip Mon..Sun */}
      <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
        {state.weekDays.map((d) => {
          const judged = !d.isFuture && !d.excused && d.grade != null;
          const bg = d.isFuture
            ? "transparent"
            : d.excused
              ? "var(--panel-2)"
              : judged
                ? TONE_COLOR[dayGradeTone(d.grade!) as Tone]
                : "var(--panel-2)";
          const title = d.isFuture
            ? `${d.label} ${d.date}: not yet`
            : d.excused
              ? `${d.label} ${d.date}: excused`
              : `${d.label} ${d.date}: ${d.points}/${d.max}`;
          return (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                title={title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: 30,
                  borderRadius: 6,
                  background: bg,
                  border: judged ? "none" : "1px solid var(--border)",
                  boxShadow: d.isToday ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                {d.excused ? (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "var(--muted)",
                    }}
                  />
                ) : null}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: d.isToday ? "var(--accent)" : "var(--muted)",
                  fontWeight: d.isToday ? 700 : 400,
                }}
              >
                {d.label[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* today so far */}
      <div style={{ marginTop: 16, fontSize: 15 }}>
        Today so far:{" "}
        <span style={{ fontWeight: 700, color: todayColor }}>
          {todayScore.points}/{todayScore.max} {todayGrade}
        </span>
      </div>
      {todayScore.perSystem.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 8,
          }}
        >
          {todayScore.perSystem.map((p) => (
            <span
              key={p.id}
              className="muted"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: p.done ? "var(--good)" : "var(--panel-2)",
                  border: p.done ? "none" : "1px solid var(--border)",
                }}
              />
              {p.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* lock */}
      {lock.locked ? (
        <div style={{ margin: "14px 0 0" }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--bad)" }}>
            Entertainment locked until{" "}
            {lock.rule === "green3"
              ? "three consecutive Green days"
              : "a Green day"}
            .
          </p>
          <button
            className="btn btn-ghost btn-auto"
            style={{ marginTop: 8 }}
            disabled={busy}
            onClick={() => run(() => liftLock(today))}
          >
            Lift the lock
          </button>
        </div>
      ) : null}

      {/* weekly habits (judged at week end) */}
      {state.weeklySystems.length > 0 ? (
        <>
          <div className="divider" style={{ margin: "18px 0" }} />
          <WeeklyHabits systems={state.weeklySystems} />
        </>
      ) : null}

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* fund */}
      <div className="card-head-row" style={{ marginBottom: 0 }}>
        <span className="block-title">{fund.name}</span>
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setShowFund((s) => !s)}
        >
          {showFund ? "Hide" : "Manage fund"}
        </button>
      </div>

      {fund.targetEur != null ? (
        <>
          <div style={{ marginTop: 12 }}>
            <span
              style={{
                display: "block",
                height: 8,
                borderRadius: 999,
                background: "var(--panel-2)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${fund.progressPct ?? 0}%`,
                  background: "var(--accent)",
                }}
              />
            </span>
          </div>
          <div
            className="muted"
            style={{ marginTop: 8, fontSize: 13, fontVariantNumeric: "tabular-nums" }}
          >
            {eur(fund.balance)} / {eur(fund.targetEur)}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>
          {eur(fund.balance)} in the fund
        </div>
      )}
      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
        contributed {eur(fund.contributed)} lifetime
      </div>

      {showFund ? (
        <div style={{ marginTop: 14 }}>
          <div className="form-row">
            <div className="field">
              <label>Fund name</label>
              <input
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                placeholder="Gear / Trip Fund"
              />
            </div>
            <div className="field">
              <label>Target (EUR, blank to clear)</label>
              <input
                type="text"
                inputMode="numeric"
                value={fundTarget}
                onChange={(e) => setFundTarget(e.target.value)}
                placeholder="none"
              />
            </div>
          </div>
          <button
            className="btn btn-auto"
            disabled={busy}
            onClick={() =>
              run(() =>
                setScoreSettings({
                  fund: {
                    name: fundName.trim() || fund.name,
                    targetEur:
                      fundTarget.trim() === "" ? null : numOr(fundTarget, 0) || null,
                  },
                })
              )
            }
          >
            {busy ? "Saving..." : "Save fund"}
          </button>

          <div className="divider" style={{ margin: "16px 0" }} />

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Log a payout (you spent the fund)</label>
            <div className="form-row" style={{ marginTop: 6 }}>
              <input
                type="text"
                inputMode="decimal"
                value={payoutAmt}
                onChange={(e) => setPayoutAmt(e.target.value)}
                placeholder="Amount"
              />
              <input
                value={payoutLabel}
                onChange={(e) => setPayoutLabel(e.target.value)}
                placeholder="What for"
              />
            </div>
          </div>
          <button
            className="btn btn-auto"
            style={{ marginTop: 4 }}
            disabled={busy || numOr(payoutAmt, 0) <= 0}
            onClick={() =>
              run(
                () => logPayout(numOr(payoutAmt, 0), payoutLabel, today),
                () => {
                  setPayoutAmt("");
                  setPayoutLabel("");
                }
              )
            }
          >
            {busy ? "Logging..." : "Log a payout"}
          </button>
        </div>
      ) : null}

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* obligations */}
      <div className="block-title">Outstanding</div>
      {state.pendingFines.length === 0 && state.pendingRuns.length === 0 ? (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
          Nothing outstanding.
        </p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {state.pendingFines.map((r) => (
            <ObligationRow
              key={r.id}
              label={r.label}
              value={r.amount_eur != null ? eur(r.amount_eur) : ""}
              busy={busy}
              onDone={() => run(() => markLedgerDone(r.id, today))}
              onWaive={() => run(() => waiveLedger(r.id))}
              doneLabel="Mark paid"
            />
          ))}
          {state.pendingRuns.map((r) => (
            <ObligationRow
              key={r.id}
              label={r.label}
              value={r.distance_km != null ? `${r.distance_km} km` : ""}
              busy={busy}
              onDone={() => run(() => markLedgerDone(r.id, today))}
              onWaive={() => run(() => waiveLedger(r.id))}
              doneLabel="Mark done"
            />
          ))}
          {state.pendingFines.length > 0 ? (
            <div
              className="muted"
              style={{
                marginTop: 10,
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Fines outstanding: {eur(state.pendingFinesTotal)}
            </div>
          ) : null}
        </div>
      )}

      {state.escalationLevel >= 2 ? (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          {state.escalationLevel} identical penalties in a row. One more
          escalates it.
        </p>
      ) : null}

      {/* add a fine by hand */}
      <div style={{ marginTop: 14 }}>
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setShowManualFine((s) => !s)}
        >
          {showManualFine ? "Hide" : "Add a fine by hand"}
        </button>
        {showManualFine ? (
          <div style={{ marginTop: 10 }}>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
              The cron logs fines automatically at your cutoff. This is for
              manual adjustments.
            </p>
            <div className="form-row">
              <div className="field">
                <label>Amount (EUR)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={mfAmt}
                  onChange={(e) => setMfAmt(e.target.value)}
                  placeholder="Amount"
                />
              </div>
              <div className="field">
                <label>Label</label>
                <input
                  value={mfLabel}
                  onChange={(e) => setMfLabel(e.target.value)}
                  placeholder="What for"
                />
              </div>
            </div>
            <button
              className="btn btn-auto"
              disabled={busy || numOr(mfAmt, 0) <= 0}
              onClick={() =>
                run(
                  () =>
                    addManualLedger({
                      kind: "fine",
                      amountEur: numOr(mfAmt, 0),
                      label: mfLabel,
                      today,
                    }),
                  () => {
                    setMfAmt("");
                    setMfLabel("");
                  }
                )
              }
            >
              {busy ? "Adding..." : "Add fine"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* exceptions */}
      <div className="card-head-row" style={{ marginBottom: 0 }}>
        <span className="block-title">Exceptions</span>
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setShowEx((s) => !s)}
        >
          {showEx ? "Hide" : "Declare an exception"}
        </button>
      </div>

      {showEx ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            An excused day carries no penalty and drops out of the week. A
            bad-body day waives the run only; the fine still applies. Use the
            same date in From and To for a single day.
          </p>
          <div className="form-row">
            <div className="field">
              <label>From</label>
              <input
                type="date"
                value={exFrom}
                onChange={(e) => {
                  const v = e.target.value;
                  setExFrom(v);
                  if (exTo < v) setExTo(v);
                }}
              />
            </div>
            <div className="field">
              <label>To</label>
              <input
                type="date"
                value={exTo}
                onChange={(e) => setExTo(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Reason</label>
            <input
              value={exReason}
              onChange={(e) => setExReason(e.target.value)}
              placeholder="Short note"
            />
          </div>
          <div className="btn-row">
            <button
              className="btn btn-auto"
              disabled={busy}
              onClick={() =>
                run(
                  () => declareException(exFrom, exTo, exReason, "excused"),
                  () => setExReason("")
                )
              }
            >
              Excused (drop from scoring)
            </button>
            <button
              className="btn btn-auto"
              disabled={busy}
              onClick={() =>
                run(
                  () => declareException(exFrom, exTo, exReason, "bad_body"),
                  () => setExReason("")
                )
              }
            >
              Bad-body day (waive the run only)
            </button>
          </div>

          {sortedExceptions.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              {shownExceptions.map((e) => (
                <div
                  key={`${e.from}_${e.to}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
                    {e.from === e.to
                      ? prettyDate(e.from)
                      : `${prettyDate(e.from)} to ${prettyDate(e.to)}`}
                    <span className="muted">
                      {" "}
                      {e.kind === "bad_body" ? "bad-body" : "excused"}
                      {e.reason ? ` (${e.reason})` : ""}
                    </span>
                  </span>
                  <button
                    className="edit-x"
                    style={{ width: 30, height: 30 }}
                    aria-label="Remove exception"
                    disabled={busy}
                    onClick={() => run(() => removeException(e.from, e.to))}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {sortedExceptions.length > 5 ? (
                <button
                  className="btn btn-ghost btn-auto"
                  style={{ marginTop: 10 }}
                  onClick={() => setShowAllEx((s) => !s)}
                >
                  {showAllEx ? "Show fewer" : `Show all (${sortedExceptions.length})`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* settings */}
      <div className="card-head-row" style={{ marginBottom: 0 }}>
        <span className="block-title">Settings</span>
        <button
          className="btn btn-ghost btn-auto"
          onClick={() => setShowSettings((s) => !s)}
        >
          {showSettings ? "Hide" : "Settings"}
        </button>
      </div>

      {showSettings ? (
        <SettingsPanel
          config={state.config}
          systems={systems}
          busy={busy}
          onSave={(patch) => run(() => setScoreSettings(patch))}
          onReset={() => {
            if (
              !window.confirm(
                "Reset outstanding? Waives every pending fine and run and lifts the lock. Your fund total stays."
              )
            )
              return;
            run(() => resetAccountability(today));
          }}
          onDisable={() => {
            if (!window.confirm("Turn scoring off? Your history stays.")) return;
            run(() => disableScoring());
          }}
        />
      ) : null}

      {error ? (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function WeeklyHabits({ systems }: { systems: ScoreState["weeklySystems"] }) {
  return (
    <div>
      <div className="block-title">Weekly habits (judged at week end)</div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {systems.map((w) => {
          const pct = w.target
            ? Math.min(100, Math.round((w.count / w.target) * 100))
            : 0;
          const countLabel = `${w.count}/${w.target ?? "no target"}${
            w.unit ? " " + w.unit : ""
          }`;
          return (
            <div key={w.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: w.met ? "var(--good)" : "var(--text)",
                  }}
                >
                  {w.name}
                </span>
                <span
                  className="muted"
                  style={{
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: w.met ? "var(--good)" : undefined,
                    whiteSpace: "nowrap",
                  }}
                >
                  {countLabel}
                  {w.met ? " met" : ""}
                </span>
              </div>
              <span
                style={{
                  display: "block",
                  height: 8,
                  borderRadius: 999,
                  background: "var(--panel-2)",
                  overflow: "hidden",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${pct}%`,
                    background: "var(--accent)",
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}>
        Miss the weekly target and it costs one fine at week end. Never fined
        daily.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ObligationRow({
  label,
  value,
  busy,
  onDone,
  onWaive,
  doneLabel,
}: {
  label: string;
  value: string;
  busy: boolean;
  onDone: () => void;
  onWaive: () => void;
  doneLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, fontSize: 14, minWidth: 140 }}>{label}</span>
      {value ? (
        <span
          className="muted"
          style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
      ) : null}
      <button className="btn btn-auto" disabled={busy} onClick={onDone}>
        {doneLabel}
      </button>
      <button
        className="btn btn-ghost btn-auto btn-danger"
        style={{ fontSize: 12, padding: "5px 10px" }}
        disabled={busy}
        onClick={onWaive}
      >
        Waive
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

// Small, calm building blocks so each settings sub-section reads the same:
// an uppercase label, then one line of muted help.
function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div className="diet-sub-label" style={{ marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Help({ children }: { children: ReactNode }) {
  return (
    <p className="muted" style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="muted" style={{ fontSize: 12, margin: "8px 0 8px" }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SettingsPanel({
  config,
  systems,
  busy,
  onSave,
  onReset,
  onDisable,
}: {
  config: ScoreConfig;
  systems: PickSystem[];
  busy: boolean;
  onSave: (patch: ScoreSettingsInput) => void;
  onReset: () => void;
  onDisable: () => void;
}) {
  const [sysIds, setSysIds] = useState<string[]>(config.systemIds);
  const [cutoffHour, setCutoffHour] = useState(String(config.cutoffHour));
  const [sleepTol, setSleepTol] = useState(String(config.sleepToleranceMin));
  const [dailyFine, setDailyFine] = useState(String(config.dailyFine));
  const [wfB, setWfB] = useState(String(config.weeklyFines.B));
  const [wfC, setWfC] = useState(String(config.weeklyFines.C));
  const [wfD, setWfD] = useState(String(config.weeklyFines.D));
  const [wfF, setWfF] = useState(String(config.weeklyFines.F));
  const [runsEnabled, setRunsEnabled] = useState(config.runsEnabled);
  const [runsWaiver, setRunsWaiver] = useState(config.runsWaiverAllowed);
  const [drkY, setDrkY] = useState(String(config.dailyRunKm.yellow));
  const [drkR, setDrkR] = useState(String(config.dailyRunKm.red));
  const [drkC, setDrkC] = useState(String(config.dailyRunKm.critical));
  const [wrkC, setWrkC] = useState(String(config.weeklyRunKm.C));
  const [wrkF, setWrkF] = useState(String(config.weeklyRunKm.F));
  const [escalationEnabled, setEscalationEnabled] = useState(
    config.escalationEnabled
  );
  const [notifyPartner, setNotifyPartner] = useState(config.notifyPartner);
  const [rcGreen3, setRcGreen3] = useState(config.rewardCatalog.green3);
  const [rcSWeek, setRcSWeek] = useState(config.rewardCatalog.sWeek);
  const [rcPerfect, setRcPerfect] = useState(config.rewardCatalog.perfectMonth);

  function toggleSys(id: string) {
    setSysIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function save() {
    onSave({
      systemIds: sysIds,
      cutoffHour: numOr(cutoffHour, config.cutoffHour),
      sleepToleranceMin: numOr(sleepTol, config.sleepToleranceMin),
      dailyFine: numOr(dailyFine, config.dailyFine),
      weeklyFines: {
        B: numOr(wfB, config.weeklyFines.B),
        C: numOr(wfC, config.weeklyFines.C),
        D: numOr(wfD, config.weeklyFines.D),
        F: numOr(wfF, config.weeklyFines.F),
      },
      runsEnabled,
      runsWaiverAllowed: runsWaiver,
      dailyRunKm: {
        yellow: numOr(drkY, config.dailyRunKm.yellow),
        red: numOr(drkR, config.dailyRunKm.red),
        critical: numOr(drkC, config.dailyRunKm.critical),
      },
      weeklyRunKm: {
        C: numOr(wrkC, config.weeklyRunKm.C),
        F: numOr(wrkF, config.weeklyRunKm.F),
      },
      escalationEnabled,
      notifyPartner,
      rewardCatalog: {
        green3: rcGreen3,
        sWeek: rcSWeek,
        perfectMonth: rcPerfect,
      },
    });
  }

  return (
    <div style={{ marginTop: 14 }}>
      {/* Scored systems */}
      <SubLabel>Scored systems</SubLabel>
      <Help>
        Daily systems set your daily grade. Weekly systems (Nx/week) are judged
        once at week end.
      </Help>
      {systems.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          No active systems to score.
        </p>
      ) : (
        systems.map((s) => (
          <label className="check-row" key={s.id}>
            <input
              type="checkbox"
              checked={sysIds.includes(s.id)}
              onChange={() => toggleSys(s.id)}
            />
            <span>{s.name}</span>
          </label>
        ))
      )}

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Timing */}
      <SubLabel>Timing</SubLabel>
      <div className="field">
        <label>Judge my day at (hour, 0 to 23)</label>
        <input
          type="text"
          inputMode="numeric"
          value={cutoffHour}
          onChange={(e) => setCutoffHour(e.target.value)}
        />
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          3 means 3am, the end of your day.
        </p>
      </div>
      <div className="field">
        <label>Sleep grace (minutes)</label>
        <input
          type="text"
          inputMode="numeric"
          value={sleepTol}
          onChange={(e) => setSleepTol(e.target.value)}
        />
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          How far off bed time or duration still counts.
        </p>
      </div>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Money */}
      <SubLabel>Money</SubLabel>
      <div className="field">
        <label>Fine for any non-perfect day (EUR)</label>
        <input
          type="text"
          inputMode="decimal"
          value={dailyFine}
          onChange={(e) => setDailyFine(e.target.value)}
        />
      </div>
      <GroupLabel>Weekly fine by grade</GroupLabel>
      <div className="field">
        <label>Week grade B (25 to 27 of 28): fine</label>
        <input
          type="text"
          inputMode="decimal"
          value={wfB}
          onChange={(e) => setWfB(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Week grade C (18 to 21): fine</label>
        <input
          type="text"
          inputMode="decimal"
          value={wfC}
          onChange={(e) => setWfC(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Week grade D (14 to 17): fine</label>
        <input
          type="text"
          inputMode="decimal"
          value={wfD}
          onChange={(e) => setWfD(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Week grade F (under 14): fine</label>
        <input
          type="text"
          inputMode="decimal"
          value={wfF}
          onChange={(e) => setWfF(e.target.value)}
        />
      </div>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Runs */}
      <SubLabel>Runs</SubLabel>
      <label className="check-row">
        <input
          type="checkbox"
          checked={runsEnabled}
          onChange={(e) => setRunsEnabled(e.target.checked)}
        />
        <span>Runs as a punishment</span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={runsWaiver}
          onChange={(e) => setRunsWaiver(e.target.checked)}
        />
        <span>A bad-body day waives that day&apos;s run</span>
      </label>

      <GroupLabel>Daily run distance</GroupLabel>
      <div className="field">
        <label>Yellow day (2 of 4): km</label>
        <input
          type="text"
          inputMode="decimal"
          value={drkY}
          onChange={(e) => setDrkY(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Red day (1 of 4): km</label>
        <input
          type="text"
          inputMode="decimal"
          value={drkR}
          onChange={(e) => setDrkR(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Critical day (0 of 4): km</label>
        <input
          type="text"
          inputMode="decimal"
          value={drkC}
          onChange={(e) => setDrkC(e.target.value)}
        />
      </div>

      <GroupLabel>Weekly run distance</GroupLabel>
      <div className="field">
        <label>Week grade C: km</label>
        <input
          type="text"
          inputMode="decimal"
          value={wrkC}
          onChange={(e) => setWrkC(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Week grade F: km</label>
        <input
          type="text"
          inputMode="decimal"
          value={wrkF}
          onChange={(e) => setWrkF(e.target.value)}
        />
      </div>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Escalation */}
      <SubLabel>Escalation</SubLabel>
      <label className="check-row">
        <input
          type="checkbox"
          checked={escalationEnabled}
          onChange={(e) => setEscalationEnabled(e.target.checked)}
        />
        <span>Escalate repeated identical penalties (3 in a row steps up)</span>
      </label>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Partner */}
      <SubLabel>Partner</SubLabel>
      <label className="check-row">
        <input
          type="checkbox"
          checked={notifyPartner}
          onChange={(e) => setNotifyPartner(e.target.checked)}
        />
        <span>Send my daily and weekly verdicts to my partner</span>
      </label>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Rewards */}
      <SubLabel>Rewards</SubLabel>
      <Help>What you earn for a strong run. The coach reads these back to you.</Help>
      <div className="field">
        <label>Three Green days</label>
        <textarea
          rows={2}
          value={rcGreen3}
          onChange={(e) => setRcGreen3(e.target.value)}
        />
      </div>
      <div className="field">
        <label>An S week</label>
        <textarea
          rows={2}
          value={rcSWeek}
          onChange={(e) => setRcSWeek(e.target.value)}
        />
      </div>
      <div className="field">
        <label>A perfect month</label>
        <textarea
          rows={2}
          value={rcPerfect}
          onChange={(e) => setRcPerfect(e.target.value)}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary btn-auto" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save settings"}
        </button>
      </div>

      <div className="divider" style={{ margin: "18px 0" }} />

      {/* Danger */}
      <SubLabel>Danger</SubLabel>
      <button
        className="btn btn-ghost btn-auto btn-danger"
        disabled={busy}
        onClick={onReset}
      >
        Reset outstanding
      </button>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
        Waives every pending fine and run and lifts the lock. Your fund total
        stays.
      </p>
      <div style={{ marginTop: 14 }}>
        <button
          className="btn btn-ghost btn-auto btn-danger"
          disabled={busy}
          onClick={onDisable}
        >
          Turn scoring off
        </button>
      </div>
    </div>
  );
}
