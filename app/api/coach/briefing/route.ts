import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge, userProfileSection } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildBriefingPrompt, BRIEFING_TASK } from "@/lib/coach/prompts";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readScheduleConfig } from "@/lib/schedule/schedule";
import { computeBriefingSignals, type BriefingRecent } from "@/lib/today/briefing";
import type { System } from "@/lib/types";

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

  const [{ data: profile }, { data: systems }, { data: recent }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("systems")
      .select("id, name, domain, active")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase
      .from("entries")
      .select("date, energy_1_10, system_statuses, meals, module_logs")
      .eq("user_id", user.id)
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(
    computeTargets(profile ?? null),
    dietConfig.targets
  );

  const signals = computeBriefingSignals({
    date,
    name: profile?.name ?? "there",
    systems: (systems as System[]) ?? [],
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    exerciseConfig: readExerciseConfig(profile?.coaching_prefs),
    proteinTarget: targets.protein,
    recent: (recent as BriefingRecent[]) ?? [],
    fixedRocks: readScheduleConfig(profile?.coaching_prefs).fixedRocks,
  });

  let system: string;
  try {
    system =
      (await loadKnowledge()) +
      "\n\n" +
      (await userProfileSection(profile?.coaching_prefs)) +
      "\n\n" +
      BRIEFING_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  try {
    const text = await generate({
      system,
      prompt: buildBriefingPrompt(signals),
      temperature: 0.7,
    });
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
