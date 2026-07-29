// Accountability scoring config (R6). Lives in coaching_prefs.scoring, read
// defensively with defaults, same pattern as readSleepConfig / readDietConfig.
// Every number the engine uses is here so nothing is hard-coded in the logic.
//
// Decisions confirmed with Mark (2026-07): a system's Min counts as a full
// point (floor doctrine); running stays as a punishment but a declared
// bad-body day waives the run only; the fund is a renamable goal with a target.

export type ScoreGradeDay = "Perfect" | "Green" | "Yellow" | "Red" | "Critical";
export type ScoreGradeWeek = "S" | "A" | "B" | "C" | "D" | "F";

export type ExceptionKind = "excused" | "bad_body";
// A date range (inclusive). Single-day exceptions have from === to. Old stored
// exceptions used {date}; the reader migrates those to {from: date, to: date}.
export type ScoreException = {
  from: string;
  to: string;
  reason: string;
  kind: ExceptionKind;
};

export type FundConfig = { name: string; targetEur: number | null };
export type RewardCatalog = { green3: string; sWeek: string; perfectMonth: string };

export type ScoreConfig = {
  enabled: boolean;
  startDate: string | null; // first local date the judge will score (set on enable)
  systemIds: string[]; // the scored systems; each worth 1 point per day
  cutoffHour: number; // the day is judged at this local hour (3 = 03:00, Mark's ~day end)
  sleepToleranceMin: number; // grace on the Sleep system's bed time + duration
  dailyFine: number; // EUR into the fund on any non-perfect day (doc: 5)
  weeklyFines: { B: number; C: number; D: number; F: number }; // doc: 5 / 10 / 15 / 20
  runsEnabled: boolean; // keep runs as a punishment (Mark: yes)
  runsWaiverAllowed: boolean; // a declared bad-body day waives that day's run only
  dailyRunKm: { yellow: number; red: number; critical: number }; // doc: 3 / 5 / 8
  weeklyRunKm: { C: number; F: number }; // doc: 5 / 10
  escalationEnabled: boolean;
  escalationFineStep: number; // EUR added when a fine escalates (doc: 5 -> 10)
  escalationRunStepKm: number; // km added when a run escalates (doc: 3 -> 5)
  notifyPartner: boolean; // scoring verifier messages to the linked partner
  fund: FundConfig;
  rewardCatalog: RewardCatalog;
  exceptions: ScoreException[];
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  enabled: false,
  startDate: null,
  systemIds: [],
  cutoffHour: 3,
  sleepToleranceMin: 15,
  dailyFine: 5,
  weeklyFines: { B: 5, C: 10, D: 15, F: 20 },
  runsEnabled: true,
  runsWaiverAllowed: true,
  dailyRunKm: { yellow: 3, red: 5, critical: 8 },
  weeklyRunKm: { C: 5, F: 10 },
  escalationEnabled: true,
  escalationFineStep: 5,
  escalationRunStepKm: 2,
  notifyPartner: true,
  fund: { name: "Gear / Trip Fund", targetEur: null },
  rewardCatalog: {
    green3: "One agreed reward: coffee, dessert, movie night, or pick the next date activity.",
    sWeek: "A bigger agreed reward: a restaurant, a day trip, or a planned buy within budget.",
    perfectMonth: "One larger reward: a weekend trip, new gear, or a premium experience.",
  },
  exceptions: [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- small defensive coercers (same spirit as the rest of the codebase) ----
function bool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}
function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}
function numIn(v: unknown, lo: number, hi: number, d: number): number {
  const n = num(v, d);
  return Math.min(hi, Math.max(lo, n));
}
function str(v: unknown, d: string): string {
  return typeof v === "string" && v.trim() ? v : d;
}
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function readScoreConfig(
  prefs: Record<string, unknown> | null | undefined
): ScoreConfig {
  const s = (prefs?.scoring ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SCORE_CONFIG;

  const wf = isObj(s.weeklyFines) ? s.weeklyFines : {};
  const drk = isObj(s.dailyRunKm) ? s.dailyRunKm : {};
  const wrk = isObj(s.weeklyRunKm) ? s.weeklyRunKm : {};
  const fund = isObj(s.fund) ? s.fund : {};
  const rc = isObj(s.rewardCatalog) ? s.rewardCatalog : {};

  return {
    enabled: bool(s.enabled, d.enabled),
    startDate: typeof s.startDate === "string" ? s.startDate : d.startDate,
    systemIds: Array.isArray(s.systemIds)
      ? s.systemIds.filter((x): x is string => typeof x === "string")
      : d.systemIds,
    cutoffHour: numIn(s.cutoffHour, 0, 23, d.cutoffHour),
    sleepToleranceMin: numIn(s.sleepToleranceMin, 0, 180, d.sleepToleranceMin),
    dailyFine: numIn(s.dailyFine, 0, 1000, d.dailyFine),
    weeklyFines: {
      B: numIn(wf.B, 0, 1000, d.weeklyFines.B),
      C: numIn(wf.C, 0, 1000, d.weeklyFines.C),
      D: numIn(wf.D, 0, 1000, d.weeklyFines.D),
      F: numIn(wf.F, 0, 1000, d.weeklyFines.F),
    },
    runsEnabled: bool(s.runsEnabled, d.runsEnabled),
    runsWaiverAllowed: bool(s.runsWaiverAllowed, d.runsWaiverAllowed),
    dailyRunKm: {
      yellow: numIn(drk.yellow, 0, 100, d.dailyRunKm.yellow),
      red: numIn(drk.red, 0, 100, d.dailyRunKm.red),
      critical: numIn(drk.critical, 0, 100, d.dailyRunKm.critical),
    },
    weeklyRunKm: {
      C: numIn(wrk.C, 0, 100, d.weeklyRunKm.C),
      F: numIn(wrk.F, 0, 100, d.weeklyRunKm.F),
    },
    escalationEnabled: bool(s.escalationEnabled, d.escalationEnabled),
    escalationFineStep: numIn(s.escalationFineStep, 0, 1000, d.escalationFineStep),
    escalationRunStepKm: numIn(s.escalationRunStepKm, 0, 100, d.escalationRunStepKm),
    notifyPartner: bool(s.notifyPartner, d.notifyPartner),
    fund: {
      name: str(fund.name, d.fund.name),
      targetEur:
        typeof fund.targetEur === "number" && Number.isFinite(fund.targetEur) && fund.targetEur > 0
          ? fund.targetEur
          : null,
    },
    rewardCatalog: {
      green3: str(rc.green3, d.rewardCatalog.green3),
      sWeek: str(rc.sWeek, d.rewardCatalog.sWeek),
      perfectMonth: str(rc.perfectMonth, d.rewardCatalog.perfectMonth),
    },
    exceptions: Array.isArray(s.exceptions)
      ? s.exceptions
          .filter(isObj)
          .map((e) => {
            // Migrate the old single-date shape {date} to a range.
            const from =
              typeof e.from === "string"
                ? e.from
                : typeof e.date === "string"
                  ? (e.date as string)
                  : "";
            const to = typeof e.to === "string" ? e.to : from;
            return {
              from,
              to: to >= from ? to : from,
              reason: str(e.reason, ""),
              kind: (e.kind === "bad_body" ? "bad_body" : "excused") as ExceptionKind,
            };
          })
          .filter((e) => DATE_RE.test(e.from) && DATE_RE.test(e.to))
      : d.exceptions,
  };
}

// Merge a partial config over the current one for writes (server actions).
export function mergeScoreConfig(
  current: ScoreConfig,
  patch: Partial<ScoreConfig>
): ScoreConfig {
  return { ...current, ...patch };
}

export function exceptionOn(
  config: ScoreConfig,
  date: string
): ScoreException | null {
  return config.exceptions.find((e) => date >= e.from && date <= e.to) ?? null;
}

export function exceptionKindOn(
  config: ScoreConfig,
  date: string
): ExceptionKind | null {
  return exceptionOn(config, date)?.kind ?? null;
}

// EUR label helper, kept ASCII-safe for Telegram + UI consistency.
export function eur(n: number): string {
  return `€${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
