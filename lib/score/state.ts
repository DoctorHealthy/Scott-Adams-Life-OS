// The one function the UI calls to render everything about scoring. It fetches
// the user's data and runs the pure engine, so no page or component ever
// recomputes a number. Server-only (uses an RLS-bound Supabase client).

import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/constants";
import { weekStartOf } from "@/lib/commitments/commitments";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readScoreConfig, eur, type ScoreConfig, type ScoreGradeDay } from "./config";
import {
  dayScore,
  dayGrade,
  isGreenDay,
  weekScore,
  computeLock,
  fundBalance,
  fundContributed,
  fundProgressPct,
  type DayScore,
  type WeekScore,
  type LockState,
  type ScoredSystemLike,
  type ScoreEntryLike,
} from "./score";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type LedgerRow = {
  id: string;
  date: string;
  source: string;
  kind: string;
  amount_eur: number | null;
  distance_km: number | null;
  label: string;
  status: string;
  release_rule: string | null;
  resolved_on: string | null;
};

export type WeekDayCell = {
  date: string;
  dow: number; // 0 Sun .. 6 Sat
  label: string; // "Mon"
  points: number | null;
  max: number;
  grade: ScoreGradeDay | null;
  isToday: boolean;
  isFuture: boolean;
  excused: boolean;
};

export type FundState = {
  name: string;
  targetEur: number | null;
  balance: number;
  contributed: number;
  progressPct: number | null;
};

export type ScoreState = {
  enabled: boolean;
  config: ScoreConfig;
  today: string;
  hasScoredSystems: boolean;
  scoredSystems: { id: string; name: string }[];

  todayScore: DayScore;
  todayGrade: ScoreGradeDay;

  weekStart: string;
  weekDays: WeekDayCell[];
  week: WeekScore; // over the days elapsed this week
  weekProjection: WeekScore["grade"];

  lock: LockState;
  fund: FundState;

  pendingFines: LedgerRow[];
  pendingRuns: LedgerRow[];
  pendingFinesTotal: number;
  escalationLevel: number; // consecutive most-recent identical daily fines

  ledger: LedgerRow[]; // recent rows for display
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function loadScoreState(
  supabase: SupabaseServer,
  userId: string,
  today: string
): Promise<ScoreState> {
  const windowStart = addDays(today, -34);

  const [{ data: profile }, { data: systemRows }, { data: entryRows }, { data: ledgerRows }] =
    await Promise.all([
      supabase.from("users").select("coaching_prefs").eq("id", userId).single(),
      supabase
        .from("systems")
        .select("id, name, domain, cadence, metric_type, target_per_week")
        .eq("user_id", userId)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("entries")
        .select("date, system_statuses, module_logs")
        .eq("user_id", userId)
        .gte("date", windowStart)
        .lte("date", today)
        .order("date", { ascending: false }),
      supabase
        .from("ledger")
        .select(
          "id, date, source, kind, amount_eur, distance_km, label, status, release_rule, resolved_on"
        )
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(120),
    ]);

  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const config = readScoreConfig(prefs);
  const sleepConfig = readSleepConfig(prefs);

  const allSystems = ((systemRows ?? []) as {
    id: string;
    name: string;
    domain: string | null;
    cadence: "daily" | "weekly";
    metric_type: string;
    target_per_week: number | null;
  }[]);

  const scored: ScoredSystemLike[] = config.systemIds
    .map((id) => allSystems.find((s) => s.id === id))
    .filter((s): s is (typeof allSystems)[number] => !!s)
    .map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      metric_type: s.metric_type,
      cadence: s.cadence,
    }));

  const entries = (entryRows ?? []) as ScoreEntryLike[];
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const ledger = (ledgerRows ?? []) as LedgerRow[];

  const scoreFor = (date: string): DayScore =>
    dayScore({ date, entry: entryByDate.get(date), systems: scored, sleepConfig, config });

  const todayScore = scoreFor(today);
  const todayGrade = dayGrade(todayScore.points, todayScore.max);

  // This week's day cells (Mon..Sun), grades only for days that have happened.
  const weekStart = weekStartOf(today);
  const weekCells: WeekDayCell[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const isFuture = date > today;
    const s = isFuture ? null : scoreFor(date);
    const [y, m, d] = date.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return {
      date,
      dow,
      label: DOW[dow],
      points: s ? s.points : null,
      max: scored.length,
      grade: s ? dayGrade(s.points, s.max) : null,
      isToday: date === today,
      isFuture,
      excused: s ? s.excused : false,
    };
  });

  const daysSoFar = weekCells
    .filter((c) => !c.isFuture)
    .map((c) => scoreFor(c.date));
  const week = weekScore(weekStart, daysSoFar);

  // Green flags (ascending, excused days omitted so a sick day never breaks a
  // streak) drive the live lock computation.
  const greens: { date: string; green: boolean }[] = [];
  for (let dt = windowStart; dt <= today; dt = addDays(dt, 1)) {
    const s = scoreFor(dt);
    if (s.excused) continue;
    greens.push({ date: dt, green: isGreenDay(s.points, s.max) });
  }
  const lock = computeLock(ledger, greens);

  const balance = fundBalance(ledger);
  const fund: FundState = {
    name: config.fund.name,
    targetEur: config.fund.targetEur,
    balance,
    contributed: fundContributed(ledger),
    progressPct: fundProgressPct(balance, config.fund.targetEur),
  };

  const pendingFines = ledger.filter((r) => r.kind === "fine" && r.status === "pending");
  const pendingRuns = ledger.filter((r) => r.kind === "run" && r.status === "pending");
  const pendingFinesTotal =
    Math.round(pendingFines.reduce((a, r) => a + Number(r.amount_eur ?? 0), 0) * 100) / 100;

  // Escalation hint: how many of the most recent daily fines share an amount.
  const dailyFines = ledger
    .filter((r) => r.kind === "fine" && (r.source === "day" || r.source === "escalation"))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let escalationLevel = 0;
  const baseAmt = dailyFines[0]?.amount_eur ?? null;
  if (baseAmt != null) {
    for (const f of dailyFines) {
      if (Number(f.amount_eur) === Number(baseAmt)) escalationLevel++;
      else break;
    }
  }

  return {
    enabled: config.enabled,
    config,
    today,
    hasScoredSystems: scored.length > 0,
    scoredSystems: scored.map((s) => ({ id: s.id, name: s.name })),
    todayScore,
    todayGrade,
    weekStart,
    weekDays: weekCells,
    week,
    weekProjection: week.grade,
    lock,
    fund,
    pendingFines,
    pendingRuns,
    pendingFinesTotal,
    escalationLevel,
    ledger,
  };
}

// A compact facts block for the coach. The coach states these as settled; it
// never computes or negotiates a consequence.
export function scoringCoachBlock(s: ScoreState): string {
  if (!s.enabled) return "- scoring not enabled";
  const lockLine = s.lock.locked
    ? `LOCKED (until ${s.lock.rule === "green3" ? "three consecutive Green days" : "a Green day"})`
    : "clear";
  const fundLine = s.fund.targetEur
    ? `${eur(s.fund.balance)} of ${eur(s.fund.targetEur)} toward ${s.fund.name}`
    : `${eur(s.fund.balance)} in ${s.fund.name}`;
  return [
    `- Day ${s.today}: ${s.todayScore.points}/${s.todayScore.max}, ${s.todayGrade}`,
    `- This week so far: ${s.week.points}/${s.week.max}, projected grade ${s.weekProjection}`,
    `- Entertainment lock: ${lockLine}`,
    `- Fund: ${fundLine}`,
    `- Outstanding: ${eur(s.pendingFinesTotal)} in fines, ${s.pendingRuns.length} run(s) pending`,
    `- Escalation: ${s.escalationLevel} identical penalt${s.escalationLevel === 1 ? "y" : "ies"} in a row`,
  ].join("\n");
}
