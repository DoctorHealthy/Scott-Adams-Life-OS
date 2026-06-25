import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import { prettyDate } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .single();

  const { count: activeCount } = await supabase
    .from("systems")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const { data: lastEntry } = await supabase
    .from("entries")
    .select("date, energy_1_10, one_line")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayName = profile?.name || user.email?.split("@")[0] || "there";

  return (
    <div className="shell">
      <TopNav email={profile?.email || user.email} />
      <main className="container">
        <div className="stack">
          <div>
            <div className="eyebrow">Life OS</div>
            <h1 style={{ marginTop: 6 }}>Good to see you, {displayName}.</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
              Run the system. Energy is the metric that rules them all. Log the
              day, hold the floor, and let the rest compound.
            </p>
          </div>

          <div className="hub-grid">
            <Link href="/checkin" className="hub-card">
              <div className="eyebrow">Daily check-in</div>
              <div className="hub-title">Log today</div>
              <p className="muted">
                Energy, your systems, one line on the day. Under 5 minutes.
              </p>
              <span className="hub-cta">Open check-in &rarr;</span>
            </Link>

            <Link href="/systems" className="hub-card">
              <div className="eyebrow">Systems engine</div>
              <div className="hub-title">
                {activeCount ?? 0} active{" "}
                {activeCount === 1 ? "system" : "systems"}
              </div>
              <p className="muted">
                Create, edit, archive. Each one needs a floor and a ceiling.
              </p>
              <span className="hub-cta">Manage systems &rarr;</span>
            </Link>
          </div>

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Last check-in
            </div>
            {lastEntry ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="last-entry-row">
                  <span className="muted">{prettyDate(lastEntry.date)}</span>
                  <span className="energy-pill">
                    Energy {lastEntry.energy_1_10 ?? "--"}/10
                  </span>
                </div>
                {lastEntry.one_line ? (
                  <p style={{ margin: 0 }}>{lastEntry.one_line}</p>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No note logged that day.
                  </p>
                )}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Nothing logged yet. Your first check-in starts the record.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
