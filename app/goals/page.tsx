import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import GoalsBoard from "@/components/GoalsBoard";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { computeTargets } from "@/lib/diet/targets";
import { readMindConfig } from "@/lib/mind/config";
import { localDateStr } from "@/lib/constants";
import {
  computeGoalProgressInputs,
  currentQuarter,
  currentYear,
  goalFromRow,
  linkChoices,
  type GoalRow,
} from "@/lib/goals/goals";
import type { System } from "@/lib/types";

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: systems }, { data: profile }, { data: recent }, { data: goalRows }] =
    await Promise.all([
      supabase
        .from("systems")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("entries")
        .select("date, energy_1_10, system_statuses, meals, module_logs")
        .eq("user_id", user.id)
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
  const date = localDateStr();
  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);
  const progressInputs = computeGoalProgressInputs({
    date,
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    exerciseConfig: readExerciseConfig(profile?.coaching_prefs),
    proteinTarget: targets.protein,
    systems: sys,
    recent: (recent ?? []) as {
      date: string;
      meals: unknown;
      module_logs: { exercise?: unknown } | null;
    }[],
  });

  const goals = ((goalRows as GoalRow[]) ?? []).map((r) => goalFromRow(r, sys));
  const mindSystem = sys.find((s) => s.domain === "Imagination") ?? null;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Goals</div>
            <h1 style={{ marginTop: 6 }}>{currentYear(date)} roadmap</h1>
          </div>
          <GoalsBoard
            goals={goals}
            year={currentYear(date)}
            thisQuarter={currentQuarter(date)}
            progressInputs={progressInputs}
            linkChoices={linkChoices(sys)}
            vision={readMindConfig(profile?.coaching_prefs).vision}
            mindSystemId={mindSystem?.id ?? null}
          />
        </div>
      </main>
    </div>
  );
}
