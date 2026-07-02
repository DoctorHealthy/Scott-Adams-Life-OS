import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildWeeklyReviewPrompt, WEEKLY_REVIEW_TASK } from "@/lib/coach/prompts";
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
  computeWeeklyStats,
  goalSnapshotFrom,
  type GoalSnapshot,
  type WeekEntry,
} from "@/lib/review/weekly";
import { addDays } from "@/lib/constants";
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
  const start = addDays(end, -6);

  const [{ data: profile }, { data: systems }, { data: entries }, { data: goalRows }] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("systems")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      // Pull a little past the window so goal-progress (which reads recent
      // days) and the sleep stats have context.
      supabase
        .from("entries")
        .select("date, energy_1_10, system_statuses, meals, module_logs")
        .eq("user_id", user.id)
        .lte("date", end)
        .order("date", { ascending: false })
        .limit(21),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const sys = (systems as System[]) ?? [];
  const rows = (entries ?? []) as WeekEntry[];
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

  // Prior weekly review, to measure goal movement.
  const { data: prior } = await supabase
    .from("reviews")
    .select("stats")
    .eq("user_id", user.id)
    .eq("kind", "weekly")
    .lt("period_end", end)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  const priorGoalSnapshot =
    ((prior?.stats as { goals?: { id: string; progress: number }[] } | null)?.goals?.map(
      (g) => ({ id: g.id, progress: g.progress })
    ) as GoalSnapshot[] | undefined) ?? null;

  const stats = computeWeeklyStats({
    end,
    systems: sys,
    entries: rows,
    sleepConfig,
    goals,
    progressInputs,
    priorGoalSnapshot,
  });

  let system: string;
  try {
    system = (await loadKnowledge()) + "\n\n" + WEEKLY_REVIEW_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const prompt = buildWeeklyReviewPrompt({ profile: profile ?? null, stats });

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

  // Store the review (snapshot + narration) so it is keepable and next week can
  // measure movement against it.
  const { error: saveError } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      kind: "weekly",
      period_start: start,
      period_end: end,
      stats: { ...stats, goalSnapshot: goalSnapshotFrom(stats) },
      narration: text,
    },
    { onConflict: "user_id,kind,period_end" }
  );
  if (saveError) {
    // The review still ran; just tell the client it was not saved.
    return NextResponse.json({ text, stats, saved: false, saveError: saveError.message });
  }

  return NextResponse.json({ text, stats, saved: true });
}
