import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import PartnerView, {
  type FriendshipRow,
  type LedgerSummary,
} from "@/components/PartnerView";
import { addDays, localDateStr } from "@/lib/constants";
import { loadScoreState } from "@/lib/score/state";
import { readScoreConfig } from "@/lib/score/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { computeTargets } from "@/lib/diet/targets";
import {
  computeGoalProgressInputs,
  goalFromRow,
  type GoalRow,
} from "@/lib/goals/goals";
import {
  buildWeekPerson,
  progressDaysFromEntries,
  readHiddenSystems,
  readHiddenGoals,
  type ProgressDay,
} from "@/lib/partner/partner";
import type { System, SystemStatus } from "@/lib/types";

export default async function PartnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const end = localDateStr();
  const start = addDays(end, -6);

  // Friendships in either direction.
  const { data: friendships } = await supabase
    .from("friendships")
    .select("id, user_id, friend_id, status")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  const rows = (friendships ?? []) as FriendshipRow[];
  const accepted = rows.find((f) => f.status === "accepted") ?? null;
  const friendId = accepted
    ? accepted.user_id === user.id
      ? accepted.friend_id
      : accepted.user_id
    : null;

  // ---- own week (same sanitized shape as the partner's) ----
  const [{ data: profile }, { data: mySystems }, { data: myEntries }, { data: myGoalRows }] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("systems")
        .select("id, name, domain, sort_order, cadence, metric_type, target_per_week")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("entries")
        .select("date, energy_1_10, system_statuses, meals, module_logs")
        .eq("user_id", user.id)
        .lte("date", end)
        .order("date", { ascending: false })
        .limit(21),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const mySys = ((mySystems ?? []) as Pick<
    System,
    "id" | "name" | "domain" | "sort_order" | "cadence" | "metric_type" | "target_per_week"
  >[]);
  const myFull = (myEntries ?? []) as {
    date: string;
    energy_1_10: number | null;
    system_statuses: Record<string, SystemStatus>;
    meals: unknown;
    module_logs: { sleep?: unknown; exercise?: unknown } | null;
  }[];
  const myDiet = readDietConfig(profile?.coaching_prefs);
  const myTargets = effectiveTargets(computeTargets(profile ?? null), myDiet.targets);
  const myGoals = ((myGoalRows as GoalRow[]) ?? []).map((r) =>
    goalFromRow(r, mySys as System[])
  );
  const myProgressInputs = computeGoalProgressInputs({
    date: end,
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    exerciseConfig: readExerciseConfig(profile?.coaching_prefs),
    proteinTarget: myTargets.protein,
    systems: mySys,
    recent: myFull,
  });

  const me = buildWeekPerson({
    name: profile?.name ?? "You",
    end,
    days7: progressDaysFromEntries(
      myFull.filter((e) => e.date >= start && e.date <= end)
    ),
    systems: mySys,
    goals: myGoals,
    sleepConfig: readSleepConfig(profile?.coaching_prefs),
    sessionsTarget: readExerciseConfig(profile?.coaching_prefs).sessionsTarget,
    proteinInputsAvailable: true,
    progressInputs: myProgressInputs,
  });

  // ---- the partner's week, via the sanitizing RPC ----
  let friend = null;
  let friendFundName = "";
  let friendFundTargetEur: number | null = null;
  let friendScoringEnabled = false;
  if (friendId) {
    const [
      { data: fProfile },
      { data: fSystems },
      { data: fGoalRows },
      { data: fProgress },
    ] = await Promise.all([
      supabase.from("users").select("*").eq("id", friendId).single(),
      supabase
        .from("systems")
        .select("id, name, domain, sort_order, cadence, metric_type, target_per_week")
        .eq("user_id", friendId)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", friendId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase.rpc("partner_progress", {
        friend: friendId,
        from_date: start,
        to_date: end,
      }),
    ]);

    const fCfg = readScoreConfig(fProfile?.coaching_prefs);
    friendFundName = fCfg.fund.name;
    friendFundTargetEur = fCfg.fund.targetEur;
    friendScoringEnabled = fCfg.enabled;

    const hidden = new Set(readHiddenSystems(fProfile?.coaching_prefs));
    const fSys = (
      (fSystems ?? []) as Pick<
        System,
        "id" | "name" | "domain" | "sort_order" | "cadence" | "metric_type" | "target_per_week"
      >[]
    ).filter((s) => !hidden.has(s.id));
    const fGoals = ((fGoalRows as GoalRow[]) ?? []).map((r) =>
      goalFromRow(r, fSys as System[])
    );
    const fDays = ((fProgress ?? []) as ProgressDay[]).map((d) => ({
      ...d,
      day: String(d.day),
    }));

    friend = buildWeekPerson({
      name: fProfile?.name ?? "Partner",
      end,
      days7: fDays,
      systems: fSys,
      goals: fGoals,
      sleepConfig: fProfile ? readSleepConfig(fProfile.coaching_prefs) : null,
      sessionsTarget: fProfile
        ? readExerciseConfig(fProfile.coaching_prefs).sessionsTarget
        : null,
      proteinInputsAvailable: false,
      progressInputs: null,
    });
  }

  // ---- accountability ledger summaries (R6, read-only) ----
  const myScore = await loadScoreState(supabase, user.id, end);
  const myLedger: LedgerSummary | null = myScore.enabled
    ? {
        fundName: myScore.fund.name,
        fundTargetEur: myScore.fund.targetEur,
        fundPct: myScore.fund.progressPct,
        fundBalance: myScore.fund.balance,
        pendingFinesTotal: myScore.pendingFinesTotal,
        pendingRunsCount: myScore.pendingRuns.length,
        locked: myScore.lock.locked,
      }
    : null;

  let friendLedger: LedgerSummary | null = null;
  if (friendId) {
    const { data: fLedger } = await supabase.rpc("partner_ledger", {
      friend: friendId,
    });
    const fRows = (fLedger ?? []) as {
      date: string;
      source: string;
      kind: string;
      amount_eur: number | null;
      distance_km: number | null;
      label: string;
      status: string;
    }[];
    // Show the partner's accountability whenever they have scoring on, even
    // before their first fine (empty rows just compute to a zero balance).
    if (friendScoringEnabled || fRows.length > 0) {
      const finesDone = fRows
        .filter((r) => r.kind === "fine" && r.status === "done")
        .reduce((a, r) => a + Number(r.amount_eur ?? 0), 0);
      const payouts = fRows
        .filter((r) => r.kind === "payout")
        .reduce((a, r) => a + Number(r.amount_eur ?? 0), 0);
      const pendingFinesTotal = fRows
        .filter((r) => r.kind === "fine" && r.status === "pending")
        .reduce((a, r) => a + Number(r.amount_eur ?? 0), 0);
      const pendingRunsCount = fRows.filter(
        (r) => r.kind === "run" && r.status === "pending"
      ).length;
      // Rows are newest-first: the first non-waived lock is the governing one.
      const latestLock = fRows.find(
        (r) => r.kind === "lock" && r.status !== "waived"
      );
      const balance = Math.round((finesDone - payouts) * 100) / 100;
      friendLedger = {
        fundName: friendFundName,
        fundTargetEur: friendFundTargetEur,
        fundPct:
          friendFundTargetEur != null
            ? Math.min(100, Math.round((balance / friendFundTargetEur) * 100))
            : null,
        fundBalance: balance,
        pendingFinesTotal: Math.round(pendingFinesTotal * 100) / 100,
        pendingRunsCount,
        locked: latestLock ? latestLock.status === "pending" : false,
      };
    }
  }

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Partner</div>
            <h1 style={{ marginTop: 6 }}>Shared progress</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Both weeks at a glance. Journals and private notes stay private;
              seeing a miss is the point.
            </p>
          </div>

          <PartnerView
            userId={user.id}
            friendships={rows}
            me={me}
            friend={friend}
            mySystems={mySys.map((s) => ({ id: s.id, name: s.name }))}
            hiddenSystems={readHiddenSystems(profile?.coaching_prefs)}
            myGoals={myGoals.map((g) => ({ id: g.id, title: g.title }))}
            hiddenGoals={readHiddenGoals(profile?.coaching_prefs)}
            myLedger={myLedger}
            friendLedger={friendLedger}
          />
        </div>
      </main>
    </div>
  );
}
