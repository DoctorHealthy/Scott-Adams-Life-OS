import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import TrendsView from "@/components/TrendsView";
import { localDateStr } from "@/lib/constants";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { buildTrendSeries, type TrendEntry } from "@/lib/trends/trends";
import type { System } from "@/lib/types";

export default async function TrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const end = localDateStr();

  const [{ data: systems }, { data: profile }, { data: entries }] =
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
        .lte("date", end)
        .order("date", { ascending: false })
        .limit(90),
    ]);

  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);

  const series = buildTrendSeries({
    end,
    days: 90,
    entries: (entries ?? []) as TrendEntry[],
    systems: (systems as System[]) ?? [],
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    proteinTarget: targets.protein,
  });

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Trends</div>
            <h1 style={{ marginTop: 6 }}>The lines that matter</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Energy, wake time, adherence, protein, weight. All computed from
              your logs.
            </p>
          </div>

          <TrendsView series={series} />

          <div className="btn-row">
            <Link href="/monthly" className="btn btn-auto">
              Monthly review
            </Link>
            <Link href="/today" className="link" style={{ alignSelf: "center" }}>
              &larr; Back to Today
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
