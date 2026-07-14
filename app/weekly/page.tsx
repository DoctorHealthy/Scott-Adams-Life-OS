import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import WeeklyReview from "@/components/WeeklyReview";
import CommitmentsManager from "@/components/CommitmentsManager";
import { localDateStr } from "@/lib/constants";
import { readReviewConfig } from "@/lib/review/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import {
  commitmentProgress,
  weekStartOf,
  type CommitmentRow,
  type CommitmentEntryLike,
} from "@/lib/commitments/commitments";
import type { WeeklyStats } from "@/lib/review/weekly";

type ReviewRow = {
  period_start: string;
  period_end: string;
  stats: WeeklyStats;
  narration: string;
};

type SystemRow = {
  id: string;
  name: string;
  cadence: "daily" | "weekly";
  metric_type: string;
  target_per_week: number | null;
  unit: string | null;
};

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = localDateStr();

  const [
    { data: profile },
    { data: reviews },
    { data: commitmentRows },
    { data: systemRows },
    { data: entryRows },
  ] = await Promise.all([
    supabase.from("users").select("coaching_prefs").eq("id", user.id).single(),
    supabase
      .from("reviews")
      .select("period_start, period_end, stats, narration")
      .eq("user_id", user.id)
      .eq("kind", "weekly")
      .order("period_end", { ascending: false })
      .limit(9),
    supabase
      .from("commitments")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(12),
    supabase
      .from("systems")
      .select("id, name, cadence, metric_type, target_per_week, unit")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("entries")
      .select("date, energy_1_10, system_statuses, meals, module_logs")
      .eq("user_id", user.id)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(21),
  ]);

  const rows = (reviews as ReviewRow[]) ?? [];
  const latest = rows[0] ?? null;
  const past = rows.slice(1).map((r) => ({
    period_start: r.period_start,
    period_end: r.period_end,
  }));
  const { weeklyDay } = readReviewConfig(profile?.coaching_prefs);

  // Commitments: progress computed in code, split into this week vs history.
  const sleepConfig = readSleepConfig(profile?.coaching_prefs);
  const commitments = (commitmentRows as CommitmentRow[]) ?? [];
  const systems = (systemRows as SystemRow[]) ?? [];
  const entries = (entryRows as CommitmentEntryLike[]) ?? [];
  const thisWeek = weekStartOf(today);

  const commitmentItems = commitments.map((c) => {
    const p = commitmentProgress({ c, entries, systems, sleepConfig, today });
    return {
      id: c.id,
      week_start: c.week_start,
      label: c.label,
      status: c.status,
      count: p.count,
      target: p.target,
      daysLeft: p.daysLeft,
      debrief: !!c.debrief,
    };
  });
  const currentItems = commitmentItems.filter((x) => x.week_start === thisWeek);
  const pastItems = commitmentItems
    .filter((x) => x.week_start !== thisWeek)
    .slice(0, 8);

  const pickerSystems = systems.map((s) => ({
    id: s.id,
    name: s.name,
    metric_type: s.metric_type,
    unit: s.unit,
  }));

  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const commitmentPrefs = (prefs.commitments ?? {}) as Record<string, unknown>;
  const exposePartner = !!commitmentPrefs.exposePartner;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Weekly review</div>
            <h1 style={{ marginTop: 6 }}>The last 7 days</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              What ran on autopilot, what needed willpower, and the one change
              for next week. All numbers computed from your logs.
            </p>
          </div>

          <CommitmentsManager
            currentWeek={currentItems}
            past={pastItems}
            systems={pickerSystems}
            exposePartner={exposePartner}
          />

          <WeeklyReview
            today={localDateStr()}
            initialStats={latest?.stats ?? null}
            initialNarration={latest?.narration ?? null}
            initialPeriodEnd={latest?.period_end ?? null}
            weeklyDay={weeklyDay}
            past={past}
          />

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
