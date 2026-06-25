import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildDailyReviewPrompt, DAILY_REVIEW_TASK } from "@/lib/coach/prompts";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readDietLog, logTotals } from "@/lib/diet/log";
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
import type { Entry, System } from "@/lib/types";

type ModuleLogs = { sleep?: unknown; exercise?: unknown };

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
  const [{ data: profile }, { data: systems }, { data: entry }, { data: recent }] =
    await Promise.all([
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
        .select("date, energy_1_10, system_statuses, module_logs")
        .eq("user_id", user.id)
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(14),
    ]);

  if (!entry) {
    return NextResponse.json(
      { error: "No check-in saved for that day. Save the check-in first." },
      { status: 400 }
    );
  }

  let system: string;
  try {
    system = (await loadKnowledge()) + "\n\n" + DAILY_REVIEW_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const config = readDietConfig(profile?.coaching_prefs);
  const eff = effectiveTargets(computeTargets(profile ?? null), config.targets);
  const dietLog = readDietLog((entry as Entry).meals);
  const logged = logTotals(dietLog.items);

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
      loggedKcal: logged.kcal,
      loggedProtein: logged.protein,
      mealCount: dietLog.items.length,
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
