import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import TodayClient from "./TodayClient";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readScheduleConfig } from "@/lib/schedule/schedule";
import type { DietMeal } from "@/lib/diet/meals";
import type { System } from "@/lib/types";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: systems }, { data: profile }] = await Promise.all([
    supabase
      .from("systems")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ]);

  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);
  const sleepConfig = readSleepConfig(profile?.coaching_prefs);
  const exerciseConfig = readExerciseConfig(profile?.coaching_prefs);
  const scheduleConfig = readScheduleConfig(profile?.coaching_prefs);

  const byId = new Map(dietConfig.meals.map((m) => [m.id, m]));
  const catalog: DietMeal[] =
    dietConfig.menu.length > 0
      ? dietConfig.menu.map((id) => byId.get(id)).filter((m): m is DietMeal => !!m)
      : dietConfig.meals;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-today">
        <TodayClient
          userId={user.id}
          systems={(systems as System[]) ?? []}
          targets={targets}
          catalog={catalog}
          sleepConfig={sleepConfig}
          exerciseConfig={exerciseConfig}
          schedule={scheduleConfig}
          dietWindow={dietConfig.window}
        />
      </main>
    </div>
  );
}
