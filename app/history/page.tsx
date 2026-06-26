import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import EntryCard, { type EntryRow, type SysMini } from "@/components/EntryCard";
import { readMindLog } from "@/lib/mind/config";

type RawEntry = {
  date: string;
  energy_1_10: number | null;
  reflection: string | null;
  system_statuses: Record<string, EntryRow["system_statuses"][string]>;
  module_logs?: { mind?: unknown };
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("systems")
    .select("id, name, domain, active")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const { data: entries } = await supabase
    .from("entries")
    .select("date, energy_1_10, reflection, system_statuses, module_logs")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const list: EntryRow[] = ((entries as RawEntry[]) ?? []).map((e) => ({
    date: e.date,
    energy_1_10: e.energy_1_10,
    reflection: e.reflection,
    intention: readMindLog(e.module_logs?.mind).intention,
    system_statuses: e.system_statuses ?? {},
  }));
  const sys = (systems as SysMini[]) ?? [];

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Check-in history</div>
            <h1 style={{ marginTop: 6 }}>
              {list.length} {list.length === 1 ? "check-in" : "check-ins"}
            </h1>
            <p className="muted" style={{ marginTop: 6 }}>
              One row per day, most recent first. Open any to see the full entry.
            </p>
          </div>

          {list.length === 0 ? (
            <div className="card empty">
              <p>No check-ins yet.</p>
              <Link href="/today" className="btn btn-primary btn-auto">
                Go to Today
              </Link>
            </div>
          ) : (
            <div className="card">
              <div className="entry-list">
                {list.map((e) => (
                  <EntryCard key={e.date} entry={e} systems={sys} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
