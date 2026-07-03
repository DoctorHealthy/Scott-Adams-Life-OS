import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge, userProfileSection } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildDailyReviewPrompt, DAILY_REVIEW_TASK } from "@/lib/coach/prompts";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readDietLog } from "@/lib/diet/log";
import {
  readSleepConfig,
  readSleepLog,
  computeSleepStats,
  HOLD_DAYS,
  targetBedtime,
} from "@/lib/sleep/sleep";
import {
  readExerciseConfig,
  readExerciseLog,
  computeExerciseStats,
  sessionTypeLabel,
} from "@/lib/exercise/exercise";
import { readMindLog, readMindConfig } from "@/lib/mind/config";
import {
  computeGoalProgressInputs,
  goalFromRow,
  goalProgress,
  type GoalRow,
} from "@/lib/goals/goals";
import { computeEnergyCorrelations } from "@/lib/review/weekly";
import { computeDailyMisses } from "@/lib/review/misses";
import { goalStaleDays, type SnapshotReview } from "@/lib/review/stale";
import { sessionForDate } from "@/lib/today/plan";
import { hhmmToMin } from "@/lib/sleep/sleep";
import type { Entry, System, SystemStatus } from "@/lib/types";

type ModuleLogs = { sleep?: unknown; exercise?: unknown; mind?: unknown };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let date: string;
  try {
    const body = await request.json();
    date = String(body?.date ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  // Load the exact data. The model reads these; it never computes them.
  const [
    { data: profile },
    { data: systems },
    { data: entry },
    { data: recent },
    { data: goalRows },
    { data: reviewRows },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("systems")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("entries")
      .select("date, energy_1_10, system_statuses, meals, module_logs")
      .eq("user_id", user.id)
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(21),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("reviews")
      .select("period_end, stats")
      .eq("user_id", user.id)
      .order("period_end", { ascending: false })
      .limit(12),
  ]);

  if (!entry) {
    return NextResponse.json(
      { error: "No check-in saved for that day. Save the check-in first." },
      { status: 400 }
    );
  }

  let system: string;
  try {
    system =
      (await loadKnowledge()) +
      "\n\n" +
      (await userProfileSection(profile?.coaching_prefs)) +
      "\n\n" +
      DAILY_REVIEW_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const config = readDietConfig(profile?.coaching_prefs);
  const eff = effectiveTargets(computeTargets(profile ?? null), config.targets);
  const dietLog = readDietLog((entry as Entry).meals);

  // Sleep + exercise: all stats computed in code from the module logs.
  const recentRows = (recent ?? []) as {
    date: string;
    module_logs?: ModuleLogs;
  }[];
  const todayModules = ((entry as Entry & { module_logs?: ModuleLogs })
    .module_logs ?? {}) as ModuleLogs;

  const sleepConfig = readSleepConfig(profile?.coaching_prefs);
  const sleepStats = computeSleepStats(
    sleepConfig,
    recentRows.map((r) => ({
      date: r.date,
      wake: readSleepLog(r.module_logs?.sleep).wake,
    }))
  );
  const todaySleep = readSleepLog(todayModules.sleep);

  const exConfig = readExerciseConfig(profile?.coaching_prefs);
  const exStats = computeExerciseStats(
    exConfig,
    recentRows.map((r) => ({
      date: r.date,
      log: readExerciseLog(r.module_logs?.exercise),
    })),
    date
  );
  const todayEx = readExerciseLog(todayModules.exercise);
  const intention = readMindLog(todayModules.mind).intention;

  // ---- M5: misses, patterns, vision, goals. All detected/computed in code. ----
  const recentFull = (recent ?? []) as {
    date: string;
    energy_1_10: number | null;
    system_statuses: Record<string, SystemStatus>;
    meals: unknown;
    module_logs: ModuleLogs | null;
  }[];

  const [yy, mm, dd] = date.split("-").map(Number);
  const dow = new Date(yy, mm - 1, dd).getDay();
  const germanDay = dow === 2 || dow === 5;

  const yesterday = recentFull.find((r) => r.date < date) ?? null;

  // Bed drift vs target, with midnight wrap: positive = later than target.
  const targetBedStr = targetBedtime(sleepConfig);
  let bedDriftMin: number | null = null;
  if (todaySleep.bed) {
    let d = hhmmToMin(todaySleep.bed) - hhmmToMin(targetBedStr);
    if (d > 720) d -= 1440;
    if (d < -720) d += 1440;
    bedDriftMin = d;
  }

  const sys = (systems as System[]) ?? [];
  const misses = computeDailyMisses({
    systems: sys,
    statuses: ((entry as Entry).system_statuses ?? {}) as Record<string, SystemStatus>,
    energyToday: (entry as Entry).energy_1_10,
    energyYesterday: yesterday?.energy_1_10 ?? null,
    sleep: {
      targetWake: sleepConfig.currentWake,
      latestWake: todaySleep.wake,
      driftMin: todaySleep.wake
        ? hhmmToMin(todaySleep.wake) - hhmmToMin(sleepConfig.currentWake)
        : null,
      targetBed: targetBedStr,
      bedLogged: todaySleep.bed,
      bedDriftMin,
      morningLight: todaySleep.morningLight,
      windDown: todaySleep.windDown,
    },
    exercise: {
      sessionDue: sessionForDate(exConfig, date),
      sessionDone: todayEx.session,
      sessionsLast7: exStats.sessionsLast7,
      sessionsTarget: exStats.sessionsTarget,
    },
    diet: {
      kcalLogged: dietLog.kcal,
      kcalTarget: eff.leanGain,
      proteinLogged: dietLog.protein,
      proteinTarget: eff.protein,
    },
    germanDay,
  });

  const correlations = computeEnergyCorrelations({
    end: date,
    windowDays: 14,
    systems: sys,
    entries: recentFull,
  });

  const goals = ((goalRows as GoalRow[]) ?? []).map((r) => goalFromRow(r, sys));
  const progressInputs = computeGoalProgressInputs({
    date,
    sleepConfig,
    exerciseConfig: exConfig,
    proteinTarget: eff.protein,
    recent: recentFull,
  });
  const goalsWithProgress = goals.map((g) => ({
    id: g.id,
    title: g.title,
    progress: goalProgress(g, progressInputs),
  }));
  const snaps: SnapshotReview[] = (
    (reviewRows as { period_end: string; stats: { goalSnapshot?: { id: string; progress: number }[] } }[]) ??
    []
  ).map((r) => ({ period_end: r.period_end, goalSnapshot: r.stats?.goalSnapshot ?? [] }));
  const stale = goalStaleDays(goalsWithProgress, snaps, date);

  const prompt = buildDailyReviewPrompt({
    profile: profile ?? null,
    systems: (systems as System[]) ?? [],
    entry: entry as Entry,
    recent: recent ?? [],
    date,
    diet: {
      ok: eff.leanGain != null,
      targetKcal: eff.leanGain,
      targetProtein: eff.protein,
      loggedKcal: dietLog.kcal,
      loggedProtein: dietLog.protein,
      waterMl: dietLog.waterMl,
      waterTargetMl: eff.waterMl,
    },
    sleep: {
      targetWake: sleepConfig.currentWake,
      targetBed: targetBedtime(sleepConfig),
      latestWake: sleepStats.latestWake,
      driftMin: sleepStats.driftMin,
      holdStreak: sleepStats.holdStreak,
      holdDays: HOLD_DAYS,
      eligible: sleepStats.eligible,
      nextWake: sleepStats.nextWake,
      atGoal: sleepStats.atGoal,
      windDownToday: todaySleep.windDown,
      morningLightToday: todaySleep.morningLight,
    },
    exercise: {
      sessionsLast7: exStats.sessionsLast7,
      sessionsTarget: exStats.sessionsTarget,
      floorStreak: exStats.floorStreak,
      warmupToday: todayEx.warmup,
      sessionToday: todayEx.session,
      sessionTypeToday: todayEx.session
        ? sessionTypeLabel(exConfig, todayEx.sessionType)
        : null,
      ankleToday: todayEx.ankle,
    },
    intention,
    misses,
    correlations,
    vision: readMindConfig(profile?.coaching_prefs).vision,
    goals: goalsWithProgress.map((g) => ({
      title: g.title,
      progress: g.progress,
      staleDays: stale.get(g.id) ?? null,
    })),
  });

  try {
    const text = await generate({ system, prompt, temperature: 0.6 });
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof CoachBusyError) {
      return NextResponse.json(
        { error: "Coach is busy right now. Tap to retry.", busy: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
