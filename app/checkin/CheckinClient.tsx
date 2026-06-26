"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDays, localDateStr, prettyDate, STATUS_META } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { saveEntry } from "./actions";
import CoachReview from "@/components/CoachReview";
import DietLog from "@/components/DietLog";
import SleepLogCard from "@/components/SleepLog";
import ExerciseLogCard from "@/components/ExerciseLog";
import MindLogCard from "@/components/MindLog";
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

const STATUSES: SystemStatus[] = ["done", "floor", "skip"];

export default function CheckinClient({
  systems,
  userId,
  targets,
  catalog,
  sleepConfig,
  exerciseConfig,
}: {
  systems: System[];
  userId: string;
  targets: EffectiveTargets;
  catalog: DietMeal[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [today] = useState(() => localDateStr());
  const [date, setDate] = useState<string | null>(null);

  const [energy, setEnergy] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<Record<string, SystemStatus>>({});
  const [dietLog, setDietLog] = useState<DietLogValue>(emptyDietLog());
  const [sleepLog, setSleepLog] = useState<SleepLog>(emptySleepLog());
  const [exerciseLog, setExerciseLog] = useState<ExerciseLog>(emptyExerciseLog());
  const [mindLog, setMindLog] = useState<MindLog>(emptyMindLog());
  const [oneLine, setOneLine] = useState("");
  const [reflection, setReflection] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryExists, setEntryExists] = useState(false);

  // Stable primitives for the sleep defaults (avoid putting the config object
  // in loadEntry's deps, which would re-run the loader every render).
  const defaultWake = sleepConfig.currentWake;
  const defaultBed = targetBedtime(sleepConfig);

  // Set the date on the client only, to avoid SSR/client hydration mismatch.
  useEffect(() => {
    setDate((d) => d ?? localDateStr());
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
      // Pre-fill wake/bed with the target times so they are not typed from
      // scratch each day. Editable; the saved value is whatever shows here.
      const sl = readSleepLog(ml.sleep);
      setSleepLog({
        ...sl,
        wake: sl.wake ?? defaultWake,
        bed: sl.bed ?? defaultBed,
      });
      setExerciseLog(readExerciseLog(ml.exercise));
      setMindLog(readMindLog(ml.mind));
      setOneLine(data?.one_line ?? "");
      setReflection(data?.reflection ?? "");
      setNextAction(data?.tomorrow_next_action ?? "");
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
      if (next[systemId] === status) {
        delete next[systemId]; // tap the active one again to clear
      } else {
        next[systemId] = status;
      }
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
      one_line: oneLine,
      reflection,
      tomorrow_next_action: nextAction,
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
    // Refresh the client Router Cache so Home shows this check-in immediately.
    router.refresh();
  }

  if (!date) {
    return (
      <div className="muted" style={{ padding: "40px 0" }}>
        Loading today...
      </div>
    );
  }

  const isToday = date === today;
  const tag = isToday
    ? "Today"
    : date === addDays(today, -1)
      ? "Yesterday"
      : null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Daily check-in</div>
          <h1 style={{ marginTop: 6 }}>
            {tag ? `${tag}, ` : ""}
            {prettyDate(date)}
          </h1>
        </div>
        <div className="date-nav">
          <button className="btn btn-ghost btn-auto" onClick={() => setDate(addDays(date, -1))}>
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
            title={isToday ? "Can't check in for the future" : ""}
          >
            &rarr;
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <div className="muted" style={{ padding: "20px 0" }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Energy: the one metric that rules them all */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Energy</span>
              <span className="energy-readout">
                {energy != null ? energy : "--"}
                <span className="energy-max">/10</span>
              </span>
            </div>
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
                style={{ marginTop: 10 }}
                onClick={() => mark(setEnergy)(5)}
              >
                Set energy
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-auto"
                style={{ marginTop: 10 }}
                onClick={() => mark(setEnergy)(null as unknown as number)}
              >
                Clear
              </button>
            )}
          </div>

          {/* Systems */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Systems</span>
            </div>
            {systems.length === 0 ? (
              <p className="muted">
                No active systems. Build some on the{" "}
                <Link href="/systems" className="link">
                  Systems
                </Link>{" "}
                page.
              </p>
            ) : (
              <div className="checkin-systems">
                {systems.map((s) => (
                  <div className="checkin-system" key={s.id}>
                    <div className="cs-info">
                      <span
                        className={`badge domain-${(s.domain ?? "custom")
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {s.domain ?? "Custom"}
                      </span>
                      <span className="cs-name">{s.name}</span>
                      {s.rule ? <span className="cs-rule">{s.rule}</span> : null}
                    </div>
                    <div className="status-group">
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          className={`status-btn status-${st}${
                            statuses[s.id] === st ? " on" : ""
                          }`}
                          title={STATUS_META[st].hint}
                          onClick={() => setStatus(s.id, st)}
                        >
                          {STATUS_META[st].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sleep: actual wake/bed, wind-down, morning light */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Sleep</span>
              <Link href={`/systems`} className="muted" style={{ fontSize: 12 }}>
                Tune in the Sleep playbook
              </Link>
            </div>
            <SleepLogCard
              config={sleepConfig}
              value={sleepLog}
              onChange={(v) => mark(setSleepLog)(v)}
            />
          </div>

          {/* Exercise: warm-up, session, ankle */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Exercise</span>
              <Link href={`/systems`} className="muted" style={{ fontSize: 12 }}>
                See the Exercise playbook
              </Link>
            </div>
            <ExerciseLogCard
              config={exerciseConfig}
              value={exerciseLog}
              onChange={(v) => mark(setExerciseLog)(v)}
            />
          </div>

          {/* Diet: meals eaten, totals computed in code vs target */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Diet</span>
              <Link href="/systems" className="muted" style={{ fontSize: 12 }}>
                Edit menu in the Diet playbook
              </Link>
            </div>
            <DietLog
              catalog={catalog}
              value={dietLog}
              onChange={(v) => mark(setDietLog)(v)}
              targets={targets}
            />
          </div>

          {/* Mind: today's gem + optional morning intention */}
          <div className="card">
            <div className="block-head">
              <span className="block-title">Mind</span>
              <Link href="/systems" className="muted" style={{ fontSize: 12 }}>
                Vision and reframes in the Mind playbook
              </Link>
            </div>
            <MindLogCard
              date={date}
              value={mindLog}
              onChange={(v) => mark(setMindLog)(v)}
            />
          </div>

          {/* Notes */}
          <div className="card">
            <div className="field">
              <label>One line on the day</label>
              <input
                value={oneLine}
                onChange={(e) => mark(setOneLine)(e.target.value)}
                placeholder="What happened, in one line"
              />
            </div>
            <div className="field">
              <label>Evening reflection</label>
              <textarea
                rows={3}
                value={reflection}
                onChange={(e) => mark(setReflection)(e.target.value)}
                placeholder="What lifted your energy, what drained it"
              />
            </div>
            <div className="field">
              <label>Tomorrow&apos;s next action</label>
              <input
                value={nextAction}
                onChange={(e) => mark(setNextAction)(e.target.value)}
                placeholder="The one smallest move for tomorrow"
              />
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => mark(setIsPrivate)(e.target.checked)}
              />
              <span>Private. Only you can see this.</span>
            </label>
          </div>

          <div className="save-bar">
            <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save check-in"}
            </button>
            <span className="save-status muted">
              {saved && !dirty
                ? "Saved."
                : dirty
                  ? "Unsaved changes."
                  : "Up to date."}
            </span>
          </div>

          <CoachReview
            key={date}
            date={date}
            enabled={entryExists && !dirty}
            hint={
              !entryExists
                ? "Save your check-in first, then get the review."
                : "Save your latest changes, then re-run the review."
            }
          />
        </>
      )}
    </div>
  );
}
