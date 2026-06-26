"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDays, localDateStr, prettyDate, STATUS_META } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { saveEntry } from "@/app/checkin/actions";
import CoachReview from "@/components/CoachReview";
import CoachBriefing from "@/components/CoachBriefing";
import AskCoach from "@/components/AskCoach";
import Modal from "@/components/Modal";
import DietLog from "@/components/DietLog";
import SleepLogCard from "@/components/SleepLog";
import ExerciseLogCard from "@/components/ExerciseLog";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets } from "@/lib/diet/config";
import { readDietLog, emptyDietLog, logTotals, type DietLogValue } from "@/lib/diet/log";
import {
  readSleepLog,
  emptySleepLog,
  targetBedtime,
  stepNumber,
  type SleepConfig,
  type SleepLog,
} from "@/lib/sleep/sleep";
import {
  readExerciseLog,
  emptyExerciseLog,
  type ExerciseConfig,
  type ExerciseLog,
} from "@/lib/exercise/exercise";
import { readMindLog, emptyMindLog, type MindLog } from "@/lib/mind/config";
import type { ScheduleConfig } from "@/lib/schedule/schedule";
import { sessionForDate } from "@/lib/today/plan";
import { gemForDate } from "@/lib/mind/gems";

const STATUSES: SystemStatus[] = ["done", "floor", "skip"];

export default function TodayClient({
  userId,
  systems,
  targets,
  catalog,
  sleepConfig,
  exerciseConfig,
  schedule,
}: {
  userId: string;
  systems: System[];
  targets: EffectiveTargets;
  catalog: DietMeal[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  schedule: ScheduleConfig;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [today] = useState(() => localDateStr());
  const [date, setDate] = useState<string | null>(null);
  const [isEvening, setIsEvening] = useState(false);

  const [energy, setEnergy] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<Record<string, SystemStatus>>({});
  const [dietLog, setDietLog] = useState<DietLogValue>(emptyDietLog());
  const [sleepLog, setSleepLog] = useState<SleepLog>(emptySleepLog());
  const [exerciseLog, setExerciseLog] = useState<ExerciseLog>(emptyExerciseLog());
  const [mindLog, setMindLog] = useState<MindLog>(emptyMindLog());
  const [reflection, setReflection] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryExists, setEntryExists] = useState(false);

  // UI state
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [showPlan, setShowPlan] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const defaultWake = sleepConfig.currentWake;
  const defaultBed = targetBedtime(sleepConfig);

  useEffect(() => {
    setDate((d) => d ?? localDateStr());
    setIsEvening(new Date().getHours() >= 18);
  }, []);

  const loadEntry = useCallback(
    async (d: string) => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId)
        .eq("date", d)
        .maybeSingle();

      if (error) setError(error.message);

      setEnergy(data?.energy_1_10 ?? null);
      setStatuses((data?.system_statuses as Record<string, SystemStatus>) ?? {});
      setDietLog(readDietLog(data?.meals));
      const ml = (data?.module_logs ?? {}) as {
        sleep?: unknown;
        exercise?: unknown;
        mind?: unknown;
      };
      const sl = readSleepLog(ml.sleep);
      setSleepLog({
        ...sl,
        wake: sl.wake ?? defaultWake,
        bed: sl.bed ?? defaultBed,
      });
      setExerciseLog(readExerciseLog(ml.exercise));
      setMindLog(readMindLog(ml.mind));
      setReflection(data?.reflection ?? "");
      setIsPrivate(data?.is_private ?? true);
      setEntryExists(!!data);
      setDirty(false);
      setSaved(false);
      setLoading(false);
    },
    [supabase, userId, defaultWake, defaultBed]
  );

  useEffect(() => {
    if (date) loadEntry(date);
  }, [date, loadEntry]);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setSaved(false);
    };
  }

  function setStatus(systemId: string, status: SystemStatus) {
    setStatuses((prev) => {
      const next = { ...prev };
      if (next[systemId] === status) delete next[systemId];
      else next[systemId] = status;
      return next;
    });
    setDirty(true);
    setSaved(false);
  }

  function toggleRow(key: string) {
    setOpenRows((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    if (!date) return;
    setSaving(true);
    setError(null);
    const res = await saveEntry({
      date,
      energy_1_10: energy,
      system_statuses: statuses,
      meals: dietLog,
      module_logs: { sleep: sleepLog, exercise: exerciseLog, mind: mindLog },
      one_line: "",
      reflection,
      tomorrow_next_action: "",
      is_private: isPrivate,
    });
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setDirty(false);
    setSaved(true);
    setEntryExists(true);
    router.refresh();
  }

  if (!date || loading) {
    return (
      <div className="muted" style={{ padding: "40px 0" }}>
        Loading today...
      </div>
    );
  }

  const isToday = date === today;
  const tag = isToday ? "Today" : date === addDays(today, -1) ? "Yesterday" : null;

  const sysByDomain = (d: string) => systems.find((s) => s.domain === d) ?? null;
  const sleepSys = sysByDomain("Sleep");
  const exSys = sysByDomain("Exercise");
  const dietSys = sysByDomain("Diet");
  const mindSys = sysByDomain("Imagination");
  const schedSys = sysByDomain("Flexible Schedule");

  const gem = gemForDate(date);
  const dietTotals = logTotals(dietLog.items);
  const sessionDue = sessionForDate(exerciseConfig, date);

  // Plain helpers that RETURN JSX (not components used as <Row/>), so the
  // expanded inputs keep focus across re-renders instead of remounting.
  const statusButtons = (sysId?: string) =>
    sysId ? (
      <div className="status-group">
        {STATUSES.map((st) => (
          <button
            key={st}
            className={`status-btn status-${st}${
              statuses[sysId] === st ? " on" : ""
            }`}
            title={STATUS_META[st].hint}
            onClick={() => setStatus(sysId, st)}
          >
            {STATUS_META[st].label}
          </button>
        ))}
      </div>
    ) : null;

  const renderRow = (
    rowKey: string,
    title: string,
    glance: string | undefined,
    sysId: string | undefined,
    body: ReactNode
  ) => {
    const open = !!openRows[rowKey];
    return (
      <div className={`sysrow${open ? " open" : ""}`} key={rowKey}>
        <div className="sysrow-head">
          <button className="sysrow-main" onClick={() => toggleRow(rowKey)}>
            <span className="sysrow-chevron">{open ? "−" : "+"}</span>
            <span className="sysrow-name">{title}</span>
            {glance ? <span className="sysrow-glance">{glance}</span> : null}
          </button>
          {statusButtons(sysId)}
        </div>
        {open ? <div className="sysrow-body">{body}</div> : null}
      </div>
    );
  };

  return (
    <div className="today-calm">
      {/* Header */}
      <div className="card">
        <div className="dayhead">
          <div>
            {tag ? <div className="eyebrow">{tag}</div> : null}
            <h1 style={{ marginTop: tag ? 4 : 0 }}>{prettyDate(date)}</h1>
          </div>
          <div className="date-nav">
            <button
              className="btn btn-ghost btn-auto"
              onClick={() => setDate(addDays(date, -1))}
              title="Previous day"
            >
              &larr;
            </button>
            <button
              className="btn btn-ghost btn-auto"
              onClick={() => setDate(today)}
              disabled={isToday}
            >
              Today
            </button>
            <button
              className="btn btn-ghost btn-auto"
              onClick={() => setDate(addDays(date, 1))}
              disabled={isToday}
              title={isToday ? "Can't log the future" : "Next day"}
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="energy-line">
          <div className="energy-num">
            {energy != null ? energy : "--"}
            <span className="energy-num-max">/10</span>
          </div>
          <div className="energy-line-controls">
            <div className="energy-label">Energy</div>
            <input
              className="energy-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={energy ?? 5}
              onChange={(e) => mark(setEnergy)(Number(e.target.value))}
            />
          </div>
        </div>

        {mindLog.intention ? (
          <div className="focus-line">
            <span className="focus-k">Focus</span>
            <span>{mindLog.intention}</span>
          </div>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {/* Briefing */}
      <div className="card">
        <CoachBriefing date={date} />
        <div className="gem-line">
          &ldquo;{gem.text}&rdquo; <span className="muted">{gem.source}</span>
        </div>
        <button
          className="link-btn"
          style={{ marginTop: 12 }}
          onClick={() => setShowPlan((s) => !s)}
        >
          {showPlan ? "Hide today's plan" : "Show today's plan"}
        </button>
        {showPlan ? (
          <div className="plan-summary">
            <div className="plan-sum-row">
              <span className="plan-sum-k">Sleep</span>
              <span>
                Wake {sleepConfig.currentWake} &middot; bed {targetBedtime(sleepConfig)}{" "}
                &middot; step {stepNumber(sleepConfig)}
              </span>
            </div>
            <div className="plan-sum-row">
              <span className="plan-sum-k">Session</span>
              <span>{sessionDue}</span>
            </div>
            <div className="plan-sum-row">
              <span className="plan-sum-k">Targets</span>
              <span>
                {targets.leanGain ?? "--"} kcal &middot; {targets.protein ?? "--"} g
                protein &middot; {targets.waterMl ?? "--"} ml water
              </span>
            </div>
            {catalog.length ? (
              <div className="plan-sum-row">
                <span className="plan-sum-k">Meals</span>
                <span>{catalog.map((m) => m.name).join(", ")}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Systems checklist */}
      <div className="syslist">
        {renderRow(
          "sleep",
          "Sleep",
          `Wake ${sleepConfig.currentWake}`,
          sleepSys?.id,
          <>
            <SleepLogCard
              config={sleepConfig}
              value={sleepLog}
              onChange={(v) => mark(setSleepLog)(v)}
            />
            <RowFoot sys={sleepSys} />
          </>
        )}

        {renderRow(
          "training",
          "Training",
          sessionDue,
          exSys?.id,
          <>
            <ExerciseLogCard
              config={exerciseConfig}
              value={exerciseLog}
              onChange={(v) => mark(setExerciseLog)(v)}
            />
            <RowFoot sys={exSys} />
          </>
        )}

        {renderRow(
          "diet",
          "Diet",
          `${dietTotals.kcal} / ${targets.leanGain ?? "--"} kcal`,
          dietSys?.id,
          <>
            <DietLog
              catalog={catalog}
              value={dietLog}
              onChange={(v) => mark(setDietLog)(v)}
              targets={targets}
            />
            <RowFoot sys={dietSys} />
          </>
        )}

        {renderRow(
          "mind",
          "Mind",
          mindLog.intention ? "intention set" : undefined,
          mindSys?.id,
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Today&apos;s intention (one line, optional)</label>
              <input
                value={mindLog.intention ?? ""}
                onChange={(e) =>
                  mark(setMindLog)({ intention: e.target.value || null })
                }
                placeholder="Set the day's posture"
              />
            </div>
            <RowFoot sys={mindSys} label="Vision and reframes" />
          </>
        )}

        {renderRow(
          "schedule",
          "Morning & schedule",
          undefined,
          schedSys?.id,
          <>
            <div className="sched-cols">
              <div>
                <div className="sched-k">Morning block</div>
                <ul className="sched-list">
                  {schedule.morningBlock.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="sched-k">Slot when free</div>
                {schedule.slotWhenFree.length ? (
                  <ul className="sched-list">
                    {schedule.slotWhenFree.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    Nothing queued.
                  </p>
                )}
              </div>
              <div>
                <div className="sched-k">Fixed rocks</div>
                {schedule.fixedRocks.length ? (
                  <ul className="sched-list">
                    {schedule.fixedRocks.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    None set.
                  </p>
                )}
              </div>
            </div>
            <RowFoot sys={schedSys} />
          </>
        )}
      </div>

      {/* Goals row (full board built next) */}
      <Link href="/goals" className="goals-row card">
        <span className="block-title">Goals</span>
        <span className="muted">Direction and progress &rarr;</span>
      </Link>

      {/* Actions */}
      <div className="today-actions">
        <button className="btn btn-primary" onClick={() => setReviewOpen(true)}>
          Review my day{isEvening ? " (ready)" : ""}
        </button>
        <button className="btn" onClick={() => setAskOpen(true)}>
          Ask the coach
        </button>
      </div>

      <div className="save-bar">
        <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save day"}
        </button>
        <span className="save-status muted">
          {saved && !dirty ? "Saved." : dirty ? "Unsaved changes." : "Up to date."}
        </span>
      </div>

      {reviewOpen ? (
        <Modal title="Review my day" onClose={() => setReviewOpen(false)}>
          <div className="field">
            <label>Evening reflection</label>
            <textarea
              rows={3}
              value={reflection}
              onChange={(e) => mark(setReflection)(e.target.value)}
              placeholder="What lifted your energy, what drained it"
            />
          </div>
          <div className="btn-row" style={{ marginBottom: 4 }}>
            <button
              className="btn btn-primary btn-auto"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save day"}
            </button>
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => mark(setIsPrivate)(e.target.checked)}
              />
              <span>Private</span>
            </label>
          </div>
          <CoachReview
            key={date}
            date={date}
            enabled={entryExists && !dirty}
            autoRun
            hint={
              !entryExists
                ? "Save the day first, then get the review."
                : "Save your latest changes, then re-run the review."
            }
          />
        </Modal>
      ) : null}

      {askOpen ? (
        <Modal title="Ask the coach" onClose={() => setAskOpen(false)}>
          <AskCoach embedded />
        </Modal>
      ) : null}
    </div>
  );
}

function RowFoot({ sys, label }: { sys: System | null; label?: string }) {
  return (
    <div className="sys-card-foot">
      <Link href={sys ? `/systems/${sys.id}` : "/systems"} className="link">
        {label ?? "Open playbook"}
      </Link>
    </div>
  );
}
