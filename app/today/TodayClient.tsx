"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDays, localDateStr, prettyDate, STATUS_META } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { saveEntry } from "@/app/checkin/actions";
import { saveGoalsForYear } from "@/app/goals/actions";
import CoachReview from "@/components/CoachReview";
import AskCoach from "@/components/AskCoach";
import Modal from "@/components/Modal";
import DietLog from "@/components/DietLog";
import SleepLogCard from "@/components/SleepLog";
import ExerciseLogCard from "@/components/ExerciseLog";
import GoalsCard from "@/components/GoalsCard";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets } from "@/lib/diet/config";
import { readDietLog, emptyDietLog, type DietLogValue } from "@/lib/diet/log";
import {
  readSleepLog,
  emptySleepLog,
  targetBedtime,
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
import type { DietWindow } from "@/lib/diet/config";
import { sessionForDate } from "@/lib/today/plan";
import { computeBriefingSignals } from "@/lib/today/briefing";
import { deriveFocusLine } from "@/lib/today/focus";
import { gemForDate } from "@/lib/mind/gems";
import Nudges from "@/components/Nudges";
import {
  computeGoalProgressInputs,
  currentQuarter,
  currentYear,
  goalProgress,
  linkChoices,
  type Goal,
} from "@/lib/goals/goals";

const STATUSES: SystemStatus[] = ["done", "floor", "skip"];

export type RecentDay = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: unknown;
  module_logs: { sleep?: unknown; exercise?: unknown } | null;
};

export default function TodayClient({
  userId,
  systems,
  targets,
  catalog,
  sleepConfig,
  exerciseConfig,
  schedule,
  dietWindow,
  recent,
  goals,
  reviewWeeklyDay,
}: {
  userId: string;
  systems: System[];
  targets: EffectiveTargets;
  catalog: DietMeal[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  schedule: ScheduleConfig;
  dietWindow: DietWindow;
  recent: RecentDay[];
  goals: Goal[];
  reviewWeeklyDay: number;
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const defaultWake = sleepConfig.currentWake;
  const defaultBed = targetBedtime(sleepConfig);

  // Diet prefill: most recent logged day's calories/protein, or the target as a
  // baseline, so the fields never start at zero.
  const priorDiet = (() => {
    for (const r of recent) {
      const d = readDietLog(r.meals);
      if (d.kcal > 0 || d.protein > 0) return d;
    }
    return null;
  })();
  const prefillKcal = priorDiet?.kcal ?? targets.leanGain ?? 0;
  const prefillProtein = priorDiet?.protein ?? targets.protein ?? 0;

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
      setDietLog(
        data
          ? readDietLog(data.meals)
          : { kcal: prefillKcal, protein: prefillProtein, waterMl: 0, weightKg: null }
      );
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
    [supabase, userId, defaultWake, defaultBed, prefillKcal, prefillProtein]
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

  // Render the user's ACTUAL systems (not a hardcoded Big Five), ordered by
  // the flow of the day: sleep, schedule, training, diet, custom, mind last.
  const DOMAIN_RANK: Record<string, number> = {
    Sleep: 0,
    "Flexible Schedule": 1,
    Exercise: 2,
    Diet: 3,
    Imagination: 99,
  };
  const orderedSystems = [...systems].sort((a, b) => {
    const ra = DOMAIN_RANK[a.domain ?? ""] ?? 10;
    const rb = DOMAIN_RANK[b.domain ?? ""] ?? 10;
    return ra - rb || a.sort_order - b.sort_order;
  });

  const gem = gemForDate(date);
  const sessionDue = sessionForDate(exerciseConfig, date);

  // Today's one-line focus: the user's intention wins; otherwise a dynamic
  // line derived in code from the same signals as the briefing. Today only.
  const codeFocus = isToday
    ? deriveFocusLine(
        computeBriefingSignals({
          date,
          name: "",
          systems,
          sleepConfig,
          exerciseConfig,
          proteinTarget: targets.protein,
          recent,
        })
      )
    : null;
  const focusLine = mindLog.intention || codeFocus;

  // ---- goal progress inputs (computed in code from recent days) ----
  const progressInputs = computeGoalProgressInputs({
    date,
    sleepConfig,
    exerciseConfig,
    proteinTarget: targets.protein,
    recent,
  });
  const progressFor = (g: Goal) => goalProgress(g, progressInputs);

  async function persistGoals(next: Goal[]) {
    const res = await saveGoalsForYear(currentYear(date ?? today), next);
    router.refresh();
    return res;
  }

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

        {focusLine ? (
          <div className="focus-line">
            <span className="focus-k">Focus</span>
            <span>{focusLine}</span>
          </div>
        ) : null}

        <div className="gem-line">
          &ldquo;{gem.text}&rdquo; <span className="muted">{gem.source}</span>
        </div>
      </div>

      {/* Time-aware in-app reminders, computed in code from the clock. */}
      {isToday ? (
        <Nudges sleepConfig={sleepConfig} sleepLog={sleepLog} dietWindow={dietWindow} />
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}

      {/* Systems checklist: the user's real systems, ordered by day flow. */}
      {orderedSystems.length === 0 ? (
        <div className="card">
          <div className="block-title">No systems yet</div>
          <p className="muted" style={{ margin: "8px 0 12px", fontSize: 14 }}>
            Your Life OS runs on systems. Set yours up in a few minutes.
          </p>
          <Link href="/onboarding" className="btn btn-primary btn-auto">
            Set up my systems
          </Link>
        </div>
      ) : (
        <div className="syslist">
          {orderedSystems.map((s) => {
            switch (s.domain) {
              case "Sleep":
                return renderRow(
                  s.id,
                  s.name,
                  `Wake ${sleepConfig.currentWake}`,
                  s.id,
                  <>
                    <SleepLogCard
                      config={sleepConfig}
                      value={sleepLog}
                      onChange={(v) => mark(setSleepLog)(v)}
                    />
                    <RowFoot sys={s} />
                  </>
                );
              case "Flexible Schedule":
                return renderRow(
                  s.id,
                  s.name,
                  undefined,
                  s.id,
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
                    <RowFoot sys={s} />
                  </>
                );
              case "Exercise":
                return renderRow(
                  s.id,
                  s.name,
                  sessionDue,
                  s.id,
                  <>
                    <ExerciseLogCard
                      config={exerciseConfig}
                      value={exerciseLog}
                      onChange={(v) => mark(setExerciseLog)(v)}
                    />
                    <RowFoot sys={s} />
                  </>
                );
              case "Diet":
                return renderRow(
                  s.id,
                  s.name,
                  `${dietLog.kcal} / ${targets.leanGain ?? "--"} kcal`,
                  s.id,
                  <>
                    <DietLog
                      catalog={catalog}
                      value={dietLog}
                      onChange={(v) => mark(setDietLog)(v)}
                      targets={targets}
                    />
                    <RowFoot sys={s} />
                  </>
                );
              case "Imagination":
                return renderRow(
                  s.id,
                  s.name,
                  mindLog.intention ? "intention set" : undefined,
                  s.id,
                  <>
                    <div className="field">
                      <label>Morning intention (one line)</label>
                      <input
                        value={mindLog.intention ?? ""}
                        onChange={(e) =>
                          mark(setMindLog)({ intention: e.target.value || null })
                        }
                        placeholder="Set the day's posture"
                      />
                    </div>
                    <div className="field">
                      <label>Evening reflection</label>
                      <p className="journal-prompts muted">
                        What happened today? What did you do about it?
                      </p>
                      <textarea
                        rows={4}
                        value={reflection}
                        onChange={(e) => mark(setReflection)(e.target.value)}
                        placeholder="Cap the day here."
                      />
                    </div>
                    <RowFoot sys={s} label="Vision and reframes" />
                  </>
                );
              default:
                // A custom system: status buttons plus its own rule and floor.
                return renderRow(
                  s.id,
                  s.name,
                  undefined,
                  s.id,
                  <>
                    {s.rule ? (
                      <p style={{ margin: "0 0 8px", fontSize: 14 }}>{s.rule}</p>
                    ) : null}
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Floor: {s.floor ?? "not set"}. Ceiling: {s.ceiling ?? "not set"}.
                    </p>
                    <RowFoot sys={s} />
                  </>
                );
            }
          })}
        </div>
      )}

      {/* Goals: compact quarter calendar on the page */}
      <GoalsCard
        initialGoals={goals}
        year={currentYear(date)}
        thisQuarter={currentQuarter(date)}
        progressFor={progressFor}
        linkChoices={linkChoices(systems)}
        onPersist={persistGoals}
        fullViewHref="/goals"
      />

      {/* Weekly review entry point, highlighted on the chosen review day. */}
      <Link
        href="/weekly"
        className={`btn weekly-btn${
          isToday && new Date().getDay() === reviewWeeklyDay ? " due" : ""
        }`}
      >
        Weekly review
        {isToday && new Date().getDay() === reviewWeeklyDay ? " (ready)" : ""}
      </Link>

      {/* Actions: Save day governs the whole entry, so it lives here at the
          page level, always visible, not buried inside a collapsed row. */}
      <div className="today-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save day"}
        </button>
        <button className="btn" onClick={() => setReviewOpen(true)}>
          Review my day{isEvening ? " (ready)" : ""}
        </button>
        <button className="btn" onClick={() => setAskOpen(true)}>
          Ask the coach
        </button>
      </div>

      <div className="today-save-row">
        <label className="check-row" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => mark(setIsPrivate)(e.target.checked)}
          />
          <span>Private. Only you can see this (journal, reflection, notes).</span>
        </label>
        <span className="save-status muted">
          {saved && !dirty ? "Saved." : dirty ? "Unsaved changes." : "Up to date."}
        </span>
      </div>

      {reviewOpen ? (
        <Modal title="Review my day" onClose={() => setReviewOpen(false)}>
          <CoachReview
            key={date}
            date={date}
            enabled={entryExists && !dirty}
            autoRun
            hint={
              !entryExists
                ? "Save the day in the Mind section first, then get the review."
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
