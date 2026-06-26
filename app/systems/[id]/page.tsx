import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import DietPlaybook from "./DietPlaybook";
import SleepPlaybook from "./SleepPlaybook";
import ExercisePlaybook from "./ExercisePlaybook";
import MindPlaybook from "./MindPlaybook";
import SchedulePlaybook from "./SchedulePlaybook";
import GenericPlaybook from "./GenericPlaybook";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig } from "@/lib/diet/config";
import { readSleepConfig, readSleepLog } from "@/lib/sleep/sleep";
import { readExerciseConfig, readExerciseLog } from "@/lib/exercise/exercise";
import { readMindConfig } from "@/lib/mind/config";
import { readScheduleConfig } from "@/lib/schedule/schedule";
import type { System } from "@/lib/types";

type ModuleLogs = { sleep?: unknown; exercise?: unknown };

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: system } = await supabase
    .from("systems")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!system) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const sys = system as System;
  const domain = sys.domain;
  const needsRecent = domain === "Sleep" || domain === "Exercise";

  let recent: { date: string; module_logs: ModuleLogs }[] = [];
  if (needsRecent) {
    const { data } = await supabase
      .from("entries")
      .select("date, module_logs")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30);
    recent = (data as { date: string; module_logs: ModuleLogs }[]) ?? [];
  }

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <Link href="/systems" className="link" style={{ fontSize: 13 }}>
              &larr; Systems
            </Link>
            <div className="eyebrow" style={{ marginTop: 10 }}>
              {domain ?? "Custom"} playbook
            </div>
            <h1 style={{ marginTop: 6 }}>{sys.name}</h1>
            {sys.rule ? (
              <p className="muted" style={{ marginTop: 8, maxWidth: 600 }}>
                {sys.rule}
              </p>
            ) : null}
          </div>

          {domain === "Diet" ? (
            <DietPlaybook
              computed={computeTargets(profile ?? null)}
              config={readDietConfig(profile?.coaching_prefs)}
            />
          ) : domain === "Sleep" ? (
            <SleepPlaybook
              config={readSleepConfig(profile?.coaching_prefs)}
              recentWakes={recent.map((r) => ({
                date: r.date,
                wake: readSleepLog(r.module_logs?.sleep).wake,
              }))}
            />
          ) : domain === "Exercise" ? (
            <ExercisePlaybook
              config={readExerciseConfig(profile?.coaching_prefs)}
              recent={recent.map((r) => ({
                date: r.date,
                log: readExerciseLog(r.module_logs?.exercise),
              }))}
            />
          ) : domain === "Imagination" ? (
            <MindPlaybook config={readMindConfig(profile?.coaching_prefs)} />
          ) : domain === "Flexible Schedule" ? (
            <SchedulePlaybook config={readScheduleConfig(profile?.coaching_prefs)} />
          ) : (
            <GenericPlaybook system={sys} />
          )}
        </div>
      </main>
    </div>
  );
}
