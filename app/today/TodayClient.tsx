"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { localDateStr, prettyDate, STATUS_META } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { saveEntry } from "@/app/checkin/actions";
import CoachReview from "@/components/CoachReview";
import CoachBriefing from "@/components/CoachBriefing";
import Nudges from "@/components/Nudges";
import AskCoach from "@/components/AskCoach";
import DietLog from "@/components/DietLog";
import SleepLogCard from "@/components/SleepLog";
import ExerciseLogCard from "@/components/ExerciseLog";
import type { DietMeal } from "@/lib/diet/meals";
import type { EffectiveTargets, DietWindow } from "@/lib/diet/config";
import { readDietLog, emptyDietLog, type DietLogValue } from "@/lib/diet/log";
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
  dietWindow,
}: {
  userId: string;
  systems: System[];
  targets: EffectiveTargets;
  catalog: DietMeal[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  schedule: ScheduleConfig;
  dietWindow: DietWindow;
}) {
  const supabase = createClient();
  const router = useRouter();

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

  const sysByDomain = (d: string) =>
    systems.find((s) => s.domain === d) ?? null;
  const sleepSys = sysByDomain("Sleep");
  const exSys = sysByDomain("Exercise");
  const dietSys = sysByDomain("Diet");
  const mindSys = sysByDomain("Imagination");
  const schedSys = sysByDomain("Flexible Schedule");

  const bigFive = new Set([
    "Sleep",
    "Exercise",
    "Diet",
    "Imagination",
    "Flexible Schedule",
  ]);
  const otherSystems = systems.filter((s) => !bigFive.has(s.domain ?? ""));

  const gem = gemForDate(date);

  function StatusButtons({ sysId }: { sysId?: string }) {
    if (!sysId) return null;
    return (
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
    );
  }

  function playbookHref(sys: System | null) {
    return sys ? `/systems/${sys.id}` : "/systems";
  }

  return (
    <div className="today2">
      {/* Header: date + energy headline */}
      <div className="card">
        <div className="today-head-row">
          <div>
            <div className="eyebrow">Today</div>
            <h1 style={{ marginTop: 6 }}>{prettyDate(date)}</h1>
          </div>
          {mindLog.intention ? (
            <div className="today-focus">
              <span className="today-focus-k">Focus</span>
              <span className="today-focus-v">{mindLog.intention}</span>
            </div>
          ) : null}
        </div>

        <div className="energy-hero">
          <div className="energy-hero-num">
            {energy != null ? energy : "--"}
            <span className="energy-hero-max">/10</span>
          </div>
          <div className="energy-hero-controls">
            <div className="energy-label">Energy, the master metric</div>
            <input
              className="energy-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={energy ?? 5}
              onChange={(e) => mark(setEnergy)(Number(e.target.value))}
            />
            <div className="energy-scale">
              <span>1 drained</span>
              <span>10 charged</span>
            </div>
            {energy == null ? (
              <button
                className="btn btn-ghost btn-auto"
                style={{ marginTop: 8 }}
                onClick={() => mark(setEnergy)(5)}
              >
                Set energy
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="today-cols">
        {/* Main grid of system cards */}
        <div className="sys-grid">
          {/* Sleep */}
          <div className="card">
            <div className="sys-card-head">
              <span className="block-title">Sleep</span>
              <StatusButtons sysId={sleepSys?.id} />
            </div>
            <div className="sys-plan">
              Wake {sleepConfig.currentWake} &middot; Bed {targetBedtime(sleepConfig)}{" "}
              &middot; Step {stepNumber(sleepConfig)}
            </div>
            <SleepLogCard
              config={sleepConfig}
              value={sleepLog}
              onChange={(v) => mark(setSleepLog)(v)}
            />
            <div className="sys-card-foot">
              <Link href={playbookHref(sleepSys)} className="link">
                Open playbook
              </Link>
            </div>
          </div>

          {/* Training */}
          <div className="card">
            <div className="sys-card-head">
              <span className="block-title">Training</span>
              <StatusButtons sysId={exSys?.id} />
            </div>
            <div className="sys-plan">
              Today: {sessionForDate(exerciseConfig, date)}
            </div>
            <ExerciseLogCard
              config={exerciseConfig}
              value={exerciseLog}
              onChange={(v) => mark(setExerciseLog)(v)}
            />
            <div className="sys-card-foot">
              <Link href={playbookHref(exSys)} className="link">
                Open playbook
              </Link>
            </div>
          </div>

          {/* Diet */}
          <div className="card">
            <div className="sys-card-head">
              <span className="block-title">Diet</span>
              <StatusButtons sysId={dietSys?.id} />
            </div>
            <DietLog
              catalog={catalog}
              value={dietLog}
              onChange={(v) => mark(setDietLog)(v)}
              targets={targets}
            />
            <div className="sys-card-foot">
              <Link href={playbookHref(dietSys)} className="link">
                Open playbook
              </Link>
            </div>
          </div>

          {/* Mind */}
          <div className="card">
            <div className="sys-card-head">
              <span className="block-title">Mind</span>
              <StatusButtons sysId={mindSys?.id} />
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Today&apos;s intention (one line, optional)</label>
              <input
                value={mindLog.intention ?? ""}
                onChange={(e) =>
                  mark(setMindLog)({ intention: e.target.value || null })
                }
                placeholder="Set the day's posture"
              />
            </div>
            <div className="sys-card-foot">
              <Link href={playbookHref(mindSys)} className="link">
                Vision and reframes
              </Link>
            </div>
          </div>

          {/* Schedule */}
          <div className="card sys-card-wide">
            <div className="sys-card-head">
              <span className="block-title">Morning &amp; schedule</span>
              <StatusButtons sysId={schedSys?.id} />
            </div>
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
                    Nothing queued. Add pull-tasks in the playbook.
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
            <div className="sys-card-foot">
              <Link href={playbookHref(schedSys)} className="link">
                Open playbook
              </Link>
            </div>
          </div>

          {/* Any custom (non Big Five) active systems */}
          {otherSystems.map((s) => (
            <div className="card" key={s.id}>
              <div className="sys-card-head">
                <span className="block-title">{s.name}</span>
                <StatusButtons sysId={s.id} />
              </div>
              {s.rule ? <div className="sys-plan">{s.rule}</div> : null}
              <div className="sys-card-foot">
                <Link href={`/systems/${s.id}`} className="link">
                  Open playbook
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Coach rail */}
        <aside className="today-rail">
          <div className="today-rail-sticky">
            <div className="card">
              <div className="block-head">
                <span className="block-title">Your briefing</span>
              </div>
              <CoachBriefing date={date} />
            </div>

            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Gem of the day
              </div>
              <blockquote className="gem gem-compact">
                <p className="gem-text">{gem.text}</p>
                <footer className="gem-source">
                  {gem.source}
                  {gem.note ? <span className="gem-note"> ({gem.note})</span> : null}
                </footer>
              </blockquote>
            </div>

            <Nudges
              sleepConfig={sleepConfig}
              sleepLog={sleepLog}
              dietWindow={dietWindow}
            />

            <div className="card">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Evening reflection</label>
                <textarea
                  rows={3}
                  value={reflection}
                  onChange={(e) => mark(setReflection)(e.target.value)}
                  placeholder="What lifted your energy, what drained it"
                />
              </div>
              <label className="check-row" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => mark(setIsPrivate)(e.target.checked)}
                />
                <span>Private. Only you can see this.</span>
              </label>
            </div>

            <CoachReview
              key={date}
              date={date}
              enabled={entryExists && !dirty}
              autoRun={isEvening}
              hint={
                !entryExists
                  ? "Save today first, then get the review."
                  : "Save your latest changes, then re-run the review."
              }
            />

            <AskCoach />
          </div>
        </aside>
      </div>

      <div className="save-bar">
        <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save today"}
        </button>
        <span className="save-status muted">
          {saved && !dirty ? "Saved." : dirty ? "Unsaved changes." : "Up to date."}
        </span>
      </div>
    </div>
  );
}
