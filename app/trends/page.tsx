import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import TrendsView from "@/components/TrendsView";
import { localDateStr } from "@/lib/constants";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { goalFromRow, type GoalRow } from "@/lib/goals/goals";
import { buildAllSeries, type ReviewSnapshot, type TrendEntry } from "@/lib/trends/trends";
import { readTrendMetrics } from "@/lib/trends/config";
import type { System } from "@/lib/types";

export default async function TrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const end = localDateStr();

  const [
    { data: systems },
    { data: profile },
    { data: entries },
    { data: goalRows },
    { data: reviews },
  ] = await Promise.all([
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
      .order("period_end", { ascending: true }),
  ]);

  const sys = (systems as System[]) ?? [];
  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);
  const goals = ((goalRows as GoalRow[]) ?? []).map((r) => goalFromRow(r, sys));

  const reviewSnaps: ReviewSnapshot[] = (
    (reviews as { period_end: string; stats: { goalSnapshot?: { id: string; progress: number }[] } }[]) ??
    []
  ).map((r) => ({
    period_end: r.period_end,
    goalSnapshot: r.stats?.goalSnapshot ?? [],
  }));

  const allSeries = buildAllSeries({
    end,
    days: 90,
    entries: (entries ?? []) as TrendEntry[],
    systems: sys,
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    targets,
    goals,
    reviews: reviewSnaps,
  });

  // Selected keys, filtered to what actually exists (drops deleted systems/goals).
  const available = new Set(allSeries.map((s) => s.key));
  const selected = readTrendMetrics(profile?.coaching_prefs).filter((k) =>
    available.has(k)
  );

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Trends</div>
            <h1 style={{ marginTop: 6 }}>The lines that matter</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Pick the trends worth watching. All computed from your logs.
            </p>
          </div>

          <TrendsView allSeries={allSeries} initialSelected={selected} />

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
