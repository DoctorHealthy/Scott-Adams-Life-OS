import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import TodayClient from "./TodayClient";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readScheduleConfig } from "@/lib/schedule/schedule";
import { goalFromRow, type GoalRow } from "@/lib/goals/goals";
import { readReviewConfig } from "@/lib/review/config";
import { loadScoreState } from "@/lib/score/state";
import { localDateStr } from "@/lib/constants";
import {
  commitmentProgress,
  weekStartOf,
  type CommitmentRow,
} from "@/lib/commitments/commitments";
import type { DietMeal } from "@/lib/diet/meals";
import type { System } from "@/lib/types";
import type { RecentDay } from "./TodayClient";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: systems }, { data: profile }, { data: recent }, { data: goalRows }] =
    await Promise.all([
      supabase
        .from("systems")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("entries")
        .select("date, energy_1_10, system_statuses, meals, module_logs")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(35), // 28 days of momentum plus slack
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  // A brand-new account has no systems: run the onboarding wizard first.
  // (A user who onboarded and later deactivated everything sees the empty
  // state on Today instead.)
  const onboarded = !!(profile?.coaching_prefs as { onboarded?: unknown } | null)
    ?.onboarded;
  if (((systems as System[]) ?? []).length === 0 && !onboarded) {
    redirect("/onboarding");
  }

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

  // This week's commitments with code-computed progress (read-only on Today).
  const today = localDateStr();
  const { data: commitmentRows } = await supabase
    .from("commitments")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start", weekStartOf(today))
    .order("created_at", { ascending: true });
  const commitments = ((commitmentRows ?? []) as CommitmentRow[]).map((c) => {
    const p = commitmentProgress({
      c,
      entries: (recent ?? []) as RecentDay[],
      systems: (systems as System[]) ?? [],
      sleepConfig,
      today,
    });
    return {
      id: c.id,
      label: c.label,
      status: c.status,
      count: p.count,
      target: p.target,
      daysLeft: p.daysLeft,
    };
  });

  // Accountability (R6). Code computes everything here; Today's chip, banner,
  // and card only display these numbers, never recompute them.
  const scoreState = await loadScoreState(supabase, user.id, today);
  const score = scoreState.enabled
    ? {
        points: scoreState.todayScore.points,
        max: scoreState.todayScore.max,
        grade: scoreState.todayGrade,
        locked: scoreState.lock.locked,
        lockRule: scoreState.lock.rule,
        weekPoints: scoreState.week.points,
        weekMax: scoreState.week.max,
        weekProjection: scoreState.weekProjection,
        fundName: scoreState.fund.name,
        fundBalance: scoreState.fund.balance,
        fundTargetEur: scoreState.fund.targetEur,
        fundPct: scoreState.fund.progressPct,
        pendingFinesTotal: scoreState.pendingFinesTotal,
        pendingRunsCount: scoreState.pendingRuns.length,
      }
    : null;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <TodayClient
          userId={user.id}
          systems={(systems as System[]) ?? []}
          targets={targets}
          catalog={catalog}
          sleepConfig={sleepConfig}
          exerciseConfig={exerciseConfig}
          schedule={scheduleConfig}
          dietWindow={dietConfig.window}
          recent={(recent as RecentDay[]) ?? []}
          goals={((goalRows as GoalRow[]) ?? []).map((r) =>
            goalFromRow(r, (systems as System[]) ?? [])
          )}
          reviewWeeklyDay={readReviewConfig(profile?.coaching_prefs).weeklyDay}
          commitments={commitments}
          score={score}
        />
      </main>
    </div>
  );
}
