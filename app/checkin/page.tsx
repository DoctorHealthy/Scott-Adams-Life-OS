import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CheckinClient from "./CheckinClient";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import type { DietMeal } from "@/lib/diet/meals";
import type { System } from "@/lib/types";

export default async function CheckinPage() {
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

  const config = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), config.targets);

  // Log against the rotation if one is set, otherwise the whole catalog.
  const byId = new Map(config.meals.map((m) => [m.id, m]));
  const catalog: DietMeal[] =
    config.menu.length > 0
      ? config.menu.map((id) => byId.get(id)).filter((m): m is DietMeal => !!m)
      : config.meals;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <CheckinClient
          systems={(systems as System[]) ?? []}
          userId={user.id}
          targets={targets}
          catalog={catalog}
        />
      </main>
    </div>
  );
}
