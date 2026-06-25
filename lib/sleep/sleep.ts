// Sleep-shift engine. All step + consistency math is here in code.
// The coach reads these numbers and advises; it never computes them.

export type SleepConfig = {
  currentWake: string; // current target wake (the step), "HH:MM"
  goalWake: string; // dream goal, "HH:MM"
  stepMinutes: number; // 15 to 30
  sleepHours: number; // desired sleep duration, used to derive target bedtime
  stepStartedOn: string | null; // YYYY-MM-DD the current step began
};

export type SleepLog = {
  wake: string | null; // actual wake "HH:MM"
  bed: string | null; // actual bedtime "HH:MM"
  windDown: boolean;
  morningLight: boolean;
};

export type SleepStats = {
  holdStreak: number; // consecutive logged days within tolerance of target wake
  withinCount: number;
  totalLogged: number;
  eligible: boolean; // held long enough to advance the step
  latestWake: string | null;
  driftMin: number | null; // latest wake minus target; positive = slept in
  nextWake: string; // where "advance" would move the target
  atGoal: boolean;
  targetBedtime: string;
};

export const HOLD_DAYS = 3; // "several days"
export const WAKE_TOLERANCE_MIN = 30;

export const DEFAULT_SLEEP_CONFIG: SleepConfig = {
  currentWake: "10:30",
  goalWake: "08:15",
  stepMinutes: 30,
  sleepHours: 8,
  stepStartedOn: null,
};

export function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function minToHHMM(min: number): string {
  const x = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(x / 60);
  const m = x % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Smallest distance between two clock times, handling midnight wrap.
export function clockDiffMin(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 720) d = 1440 - d;
  return d;
}

export function readSleepConfig(
  prefs: Record<string, unknown> | null | undefined
): SleepConfig {
  const s = (prefs?.sleep ?? {}) as Partial<SleepConfig>;
  return { ...DEFAULT_SLEEP_CONFIG, ...s };
}

export function emptySleepLog(): SleepLog {
  return { wake: null, bed: null, windDown: false, morningLight: false };
}

export function readSleepLog(raw: unknown): SleepLog {
  if (raw && typeof raw === "object") {
    const o = raw as Partial<SleepLog>;
    return {
      wake: typeof o.wake === "string" ? o.wake : null,
      bed: typeof o.bed === "string" ? o.bed : null,
      windDown: !!o.windDown,
      morningLight: !!o.morningLight,
    };
  }
  return emptySleepLog();
}

export function targetBedtime(c: SleepConfig): string {
  return minToHHMM(hhmmToMin(c.currentWake) - c.sleepHours * 60);
}

export function atGoal(c: SleepConfig): boolean {
  return hhmmToMin(c.currentWake) <= hhmmToMin(c.goalWake);
}

export function nextWake(c: SleepConfig): string {
  const n = hhmmToMin(c.currentWake) - c.stepMinutes;
  return minToHHMM(Math.max(n, hhmmToMin(c.goalWake)));
}

export function computeSleepStats(
  c: SleepConfig,
  recent: { date: string; wake: string | null }[]
): SleepStats {
  const target = hhmmToMin(c.currentWake);
  const inWindow = recent
    .filter((r) => r.wake && (!c.stepStartedOn || r.date >= c.stepStartedOn))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  let withinCount = 0;
  for (const r of inWindow) {
    if (clockDiffMin(hhmmToMin(r.wake as string), target) <= WAKE_TOLERANCE_MIN)
      withinCount++;
  }

  let holdStreak = 0;
  for (const r of inWindow) {
    if (clockDiffMin(hhmmToMin(r.wake as string), target) <= WAKE_TOLERANCE_MIN)
      holdStreak++;
    else break;
  }

  const latest = inWindow[0]?.wake ?? null;
  const driftMin = latest ? hhmmToMin(latest) - target : null;

  return {
    holdStreak,
    withinCount,
    totalLogged: inWindow.length,
    eligible: holdStreak >= HOLD_DAYS && !atGoal(c),
    latestWake: latest,
    driftMin,
    nextWake: nextWake(c),
    atGoal: atGoal(c),
    targetBedtime: targetBedtime(c),
  };
}
