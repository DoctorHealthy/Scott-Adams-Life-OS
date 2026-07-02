import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import WeeklyReview from "@/components/WeeklyReview";
import { localDateStr } from "@/lib/constants";
import { readReviewConfig } from "@/lib/review/config";
import type { WeeklyStats } from "@/lib/review/weekly";

type ReviewRow = {
  period_start: string;
  period_end: string;
  stats: WeeklyStats;
  narration: string;
};

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: reviews }] = await Promise.all([
    supabase.from("users").select("coaching_prefs").eq("id", user.id).single(),
    supabase
      .from("reviews")
      .select("period_start, period_end, stats, narration")
      .eq("user_id", user.id)
      .eq("kind", "weekly")
      .order("period_end", { ascending: false })
      .limit(9),
  ]);

  const rows = (reviews as ReviewRow[]) ?? [];
  const latest = rows[0] ?? null;
  const past = rows.slice(1).map((r) => ({
    period_start: r.period_start,
    period_end: r.period_end,
  }));
  const { weeklyDay } = readReviewConfig(profile?.coaching_prefs);

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

          <WeeklyReview
            today={localDateStr()}
            initialStats={latest?.stats ?? null}
            initialNarration={latest?.narration ?? null}
            initialPeriodEnd={latest?.period_end ?? null}
            weeklyDay={weeklyDay}
            past={past}
          />

          <div>
            <Link href="/today" className="link">
              &larr; Back to Today
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
