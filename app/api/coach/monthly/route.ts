import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge, userProfileSection } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildMonthlyReviewPrompt, MONTHLY_REVIEW_TASK } from "@/lib/coach/prompts";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import {
  computeGoalProgressInputs,
  goalFromRow,
  type GoalRow,
} from "@/lib/goals/goals";
import {
  computeMonthlyStats,
  monthStartOf,
  prevMonthRange,
  type MonthEntry,
} from "@/lib/review/monthly";
import { goalStaleDays, type SnapshotReview } from "@/lib/review/stale";
import type { System } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let end: string;
  try {
    const body = await request.json();
    end = String(body?.date ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  // The window we need: this month plus the whole previous month.
  const prevStart = prevMonthRange(end).start;

  const [{ data: profile }, { data: systems }, { data: entries }, { data: goalRows }] =
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
        .select("date, energy_1_10, system_statuses, meals, module_logs")
        .eq("user_id", user.id)
        .gte("date", prevStart)
        .lte("date", end)
        .order("date", { ascending: false }),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const sys = (systems as System[]) ?? [];
  const rows = (entries ?? []) as MonthEntry[];
  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);
  const sleepConfig = readSleepConfig(profile?.coaching_prefs);
  const exerciseConfig = readExerciseConfig(profile?.coaching_prefs);
  const goals = ((goalRows as GoalRow[]) ?? []).map((r) => goalFromRow(r, sys));

  const progressInputs = computeGoalProgressInputs({
    date: end,
    sleepConfig,
    exerciseConfig,
    proteinTarget: targets.protein,
    recent: rows,
  });

  // Review history: the latest prior monthly for goal movement, everything for
  // staleness (all computed in code).
  const { data: priorReviews } = await supabase
    .from("reviews")
    .select("period_end, kind, stats")
    .eq("user_id", user.id)
    .lt("period_end", end)
    .order("period_end", { ascending: false })
    .limit(12);
  const priorList =
    (priorReviews as {
      period_end: string;
      kind: string;
      stats: { goalSnapshot?: { id: string; progress: number }[] };
    }[]) ?? [];
  const priorGoalSnapshot =
    priorList.find((r) => r.kind === "monthly" && r.period_end < monthStartOf(end))
      ?.stats.goalSnapshot ?? null;

  const stats = computeMonthlyStats({
    end,
    entries: rows,
    systems: sys,
    sleepConfig,
    proteinTarget: targets.protein,
    goals,
    progressInputs,
    priorGoalSnapshot,
  });

  const snaps: SnapshotReview[] = priorList.map((r) => ({
    period_end: r.period_end,
    goalSnapshot: r.stats.goalSnapshot ?? [],
  }));
  const stale = goalStaleDays(
    stats.goals.map((g) => ({ id: g.id, progress: g.progress })),
    snaps,
    end
  );
  stats.goals = stats.goals.map((g) => ({ ...g, staleDays: stale.get(g.id) ?? null }));

  let system: string;
  try {
    system =
      (await loadKnowledge()) +
      "\n\n" +
      (await userProfileSection(profile?.coaching_prefs)) +
      "\n\n" +
      MONTHLY_REVIEW_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const prompt = buildMonthlyReviewPrompt({ profile: profile ?? null, stats });

  let text: string;
  try {
    text = await generate({ system, prompt, temperature: 0.6, maxOutputTokens: 1400 });
  } catch (e) {
    if (e instanceof CoachBusyError) {
      return NextResponse.json(
        { error: "Coach is busy right now. Tap to retry.", busy: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const goalSnapshot = stats.goals.map((g) => ({ id: g.id, progress: g.progress }));
  const { error: saveError } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      kind: "monthly",
      period_start: stats.start,
      period_end: end,
      stats: { ...stats, goalSnapshot },
      narration: text,
    },
    { onConflict: "user_id,kind,period_end" }
  );
  if (saveError) {
    return NextResponse.json({ text, stats, saved: false, saveError: saveError.message });
  }

  return NextResponse.json({ text, stats, saved: true });
}
