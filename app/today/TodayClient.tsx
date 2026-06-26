"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { localDateStr, prettyDate, STATUS_META } from "@/lib/constants";
import type { System, SystemStatus } from "@/lib/types";
import { saveEntry } from "@/app/checkin/actions";
import CoachReview from "@/components/CoachReview";
import CoachBriefing from "@/components/CoachBriefing";
import PlanCard from "@/components/PlanCard";
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
import { buildPlan } from "@/lib/today/plan";

const STATUSES: SystemStatus[] = ["done", "floor", "skip"];

export default function TodayClient({
  userId,
  systems,
  targets,
  catalog,
  sleepConfig,
  exerciseConfig,
  morningBlock,
  dietWindow,
}: {
  userId: string;
  systems: System[];
  targets: EffectiveTargets;
  catalog: DietMeal[];
  sleepConfig: SleepConfig;
  exerciseConfig: ExerciseConfig;
  morningBlock: string[];
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

  const plan = useMemo(
    () =>
      date
        ? buildPlan({
            date,
            sleepConfig,
            morningBlock,
            exerciseConfig,
            dietCatalog: catalog,
            targets,
          })
        : null,
    [date, sleepConfig, morningBlock, exerciseConfig, catalog, targets]
  );

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

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Today</div>
        <h1 style={{ marginTop: 6 }}>{prettyDate(date)}</h1>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <Nudges sleepConfig={sleepConfig} sleepLog={sleepLog} dietWindow={dietWindow} />

      {/* Coach briefing + the code-assembled plan + intention */}
      <div className="card">
        <div className="block-head">
          <span className="block-title">Your briefing</span>
        </div>
        <CoachBriefing date={date} />
        {plan ? <PlanCard plan={plan} /> : null}
        <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
          <label>Today&apos;s intention (one line, optional)</label>
          <input
            value={mindLog.intention ?? ""}
            onChange={(e) =>
              mark(setMindLog)({ intention: e.target.value || null })
            }
            placeholder="Set the day's posture"
          />
        </div>
      </div>

      {/* Energy */}
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
          <Link href="/systems" className="muted" style={{ fontSize: 12 }}>
            Playbooks and setup
          </Link>
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

      {/* Diet */}
      <div className="card">
        <div className="block-head">
          <span className="block-title">Diet</span>
        </div>
        <DietLog
          catalog={catalog}
          value={dietLog}
          onChange={(v) => mark(setDietLog)(v)}
          targets={targets}
        />
      </div>

      {/* Sleep */}
      <div className="card">
        <div className="block-head">
          <span className="block-title">Sleep</span>
        </div>
        <SleepLogCard
          config={sleepConfig}
          value={sleepLog}
          onChange={(v) => mark(setSleepLog)(v)}
        />
      </div>

      {/* Exercise */}
      <div className="card">
        <div className="block-head">
          <span className="block-title">Exercise</span>
        </div>
        <ExerciseLogCard
          config={exerciseConfig}
          value={exerciseLog}
          onChange={(v) => mark(setExerciseLog)(v)}
        />
      </div>

      <div className="save-bar">
        <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save today"}
        </button>
        <span className="save-status muted">
          {saved && !dirty ? "Saved." : dirty ? "Unsaved changes." : "Up to date."}
        </span>
      </div>

      {/* Evening read */}
      <div className="card">
        <div className="field">
          <label>Evening reflection</label>
          <textarea
            rows={3}
            value={reflection}
            onChange={(e) => mark(setReflection)(e.target.value)}
            placeholder="What lifted your energy, what drained it"
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

      <div>
        <AskCoach />
      </div>
    </div>
  );
}
