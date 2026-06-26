import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildBriefingPrompt, BRIEFING_TASK } from "@/lib/coach/prompts";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readScheduleConfig } from "@/lib/schedule/schedule";
import { buildPlan } from "@/lib/today/plan";
import type { DietMeal } from "@/lib/diet/meals";

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

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(
    computeTargets(profile ?? null),
    dietConfig.targets
  );
  const byId = new Map(dietConfig.meals.map((m) => [m.id, m]));
  const catalog: DietMeal[] =
    dietConfig.menu.length > 0
      ? dietConfig.menu.map((id) => byId.get(id)).filter((m): m is DietMeal => !!m)
      : dietConfig.meals;

  const plan = buildPlan({
    date,
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    morningBlock: readScheduleConfig(profile?.coaching_prefs).morningBlock,
    exerciseConfig: readExerciseConfig(profile?.coaching_prefs),
    dietCatalog: catalog,
    targets,
  });

  let system: string;
  try {
    system = (await loadKnowledge()) + "\n\n" + BRIEFING_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const prompt = buildBriefingPrompt({ profile: profile ?? null, plan });

  try {
    const text = await generate({ system, prompt, temperature: 0.7 });
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
