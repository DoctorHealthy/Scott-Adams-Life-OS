import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import MonthlyReview from "@/components/MonthlyReview";
import { localDateStr } from "@/lib/constants";
import type { MonthlyStats } from "@/lib/review/monthly";

type ReviewRow = {
  period_start: string;
  period_end: string;
  stats: MonthlyStats;
  narration: string;
};

export default async function MonthlyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviews } = await supabase
    .from("reviews")
    .select("period_start, period_end, stats, narration")
    .eq("user_id", user.id)
    .eq("kind", "monthly")
    .order("period_end", { ascending: false })
    .limit(7);

  const rows = (reviews as ReviewRow[]) ?? [];
  const latest = rows[0] ?? null;
  const past = rows.slice(1).map((r) => ({
    period_start: r.period_start,
    period_end: r.period_end,
  }));

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Monthly review</div>
            <h1 style={{ marginTop: 6 }}>The zoom-out</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              The month's trends, goal progress, what changed versus last month,
              and the one lever for next month.
            </p>
          </div>

          <MonthlyReview
            today={localDateStr()}
            initialStats={latest?.stats ?? null}
            initialNarration={latest?.narration ?? null}
            initialPeriodEnd={latest?.period_end ?? null}
            past={past}
          />

          <div className="btn-row">
            <Link href="/trends" className="btn btn-auto">
              Trends
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
