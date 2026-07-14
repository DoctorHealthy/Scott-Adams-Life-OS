import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig, effectiveTargets } from "@/lib/diet/config";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readExerciseConfig } from "@/lib/exercise/exercise";
import {
  computeGoalProgressInputs,
  goalFromRow,
  goalProgress,
  type GoalRow,
} from "@/lib/goals/goals";
import {
  computeMonthlyStats,
  prevMonthRange,
  type MonthEntry,
} from "@/lib/review/monthly";
import { computeRecords, recordsBlock } from "@/lib/records/records";
import type { System } from "@/lib/types";

// GET /api/export?month=YYYY-MM&format=json|md
// Downloads one month of the user's own data: raw JSON for machines, or a
// markdown brief written to be pasted straight into an LLM. Numbers computed
// in code, as everywhere else. No AI involved in producing the export.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const format = url.searchParams.get("format") === "md" ? "md" : "json";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM." }, { status: 400 });
  }

  const start = `${month}-01`;
  const lastDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0
  ).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  const prevStart = prevMonthRange(end).start;

  const [
    { data: profile },
    { data: systems },
    { data: entries },
    { data: goalRows },
    { data: reviews },
    { data: commitments },
    { data: allEntries },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("systems")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("entries")
      .select("date, energy_1_10, system_statuses, meals, reflection, module_logs")
      .eq("user_id", user.id)
      .gte("date", prevStart)
      .lte("date", end)
      .order("date", { ascending: true }),
    supabase.from("goals").select("*").eq("user_id", user.id),
    supabase
      .from("reviews")
      .select("kind, period_start, period_end, stats, narration")
      .eq("user_id", user.id)
      .gte("period_end", start)
      .lte("period_end", end)
      .order("period_end", { ascending: true }),
    supabase
      .from("commitments")
      .select("week_start, label, target, status, debrief")
      .eq("user_id", user.id)
      .gte("week_start", start)
      .lte("week_start", end)
      .order("week_start", { ascending: true }),
    supabase
      .from("entries")
      .select("date, energy_1_10, module_logs")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
  ]);

  const sys = (systems as System[]) ?? [];
  const activeSys = sys.filter((s) => s.active);
  const rows = (entries ?? []) as MonthEntry[];
  const monthRows = rows.filter((e) => e.date >= start && e.date <= end);
  const dietConfig = readDietConfig(profile?.coaching_prefs);
  const targets = effectiveTargets(computeTargets(profile ?? null), dietConfig.targets);
  const sleepConfig = readSleepConfig(profile?.coaching_prefs);
  const exerciseConfig = readExerciseConfig(profile?.coaching_prefs);
  const goals = ((goalRows as GoalRow[]) ?? []).map((r) => goalFromRow(r, sys));

  const progressInputs = computeGoalProgressInputs({
    date: end,
    sleepConfig,
    exerciseConfig,
    proteinTarget: targets.protein,
    systems: activeSys,
    recent: [...rows].reverse(),
  });
  const stats = computeMonthlyStats({
    end,
    entries: rows,
    systems: activeSys,
    sleepConfig,
    proteinTarget: targets.protein,
    goals: goals.filter((g) => g.status === "active"),
    progressInputs,
    priorGoalSnapshot: null,
  });
  const records = computeRecords(
    ((allEntries ?? []) as {
      date: string;
      energy_1_10: number | null;
      module_logs: { sleep?: unknown; exercise?: unknown } | null;
    }[]),
    exerciseConfig.routines
  );

  if (format === "json") {
    const payload = {
      exported_at: new Date().toISOString(),
      month,
      profile: {
        name: profile?.name ?? null,
        targets,
        sleepConfig,
      },
      month_stats: stats,
      records,
      systems: sys.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        rule: s.rule,
        min: s.floor,
        ceiling: s.ceiling,
        cadence: s.cadence,
        target_per_week: s.target_per_week,
        unit: s.unit,
        active: s.active,
      })),
      goals,
      commitments: commitments ?? [],
      reviews: reviews ?? [],
      entries: monthRows,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="life-os-${month}.json"`,
      },
    });
  }

  // ---- markdown brief, written for pasting into an LLM ----
  const m = stats.month;
  const goalLines = goals
    .filter((g) => g.status === "active")
    .map((g) => `- ${g.title} (Q${g.quarter}): ${goalProgress(g, progressInputs)}%`)
    .join("\n");
  const commitmentLines = (commitments ?? [])
    .map(
      (c) =>
        `- week of ${c.week_start}: ${c.label} -> ${String(c.status).toUpperCase()}${
          c.debrief ? `\n  debrief: ${c.debrief}` : ""
        }`
    )
    .join("\n");
  const reviewBlocks = ((reviews ?? []) as { kind: string; period_start: string; period_end: string; narration: string }[])
    .map(
      (r) =>
        `### ${r.kind} review, ${r.period_start} to ${r.period_end}\n\n${r.narration}`
    )
    .join("\n\n");

  const md = `# Life OS export: ${profile?.name ?? "user"}, ${month}

Context for an AI: this is one month of a personal life operating system built
on Scott Adams' systems-over-goals philosophy. All numbers below were computed
by code from daily logs, not estimated.

## The month in numbers
- Days logged: ${m.daysLogged} of ${m.daysInWindow}
- Energy average: ${m.energyAvg ?? "not logged"} / 10
- Sleep consistency: ${m.sleepConsistencyPct != null ? `${m.sleepConsistencyPct}% of ${m.wakesLogged} logged wakes within 30 min of target` : "not logged"}
- System adherence: ${m.adherencePct != null ? `${m.adherencePct}%` : "not logged"}
- Protein average: ${m.proteinAvg != null ? `${m.proteinAvg} g` : "not logged"} (hit target ${m.proteinDaysHit} of ${m.proteinDaysLogged} logged days)
- Weight: ${m.weightFirst != null && m.weightLast != null ? `${m.weightFirst} kg to ${m.weightLast} kg` : m.weightLast != null ? `${m.weightLast} kg` : "not logged"}
- Sleep campaign: wake target ${sleepConfig.currentWake}, goal ${sleepConfig.goalWake}

## Systems this month
${stats.systems.map((s) => `- ${s.name}: ${s.done} done, ${s.floor} min, ${s.skip} skip${s.ranPct != null ? ` (ran ${s.ranPct}%)` : ""}`).join("\n")}

## Active goals
${goalLines || "- none"}

## Commitments
${commitmentLines || "- none this month"}

## All-time records
${recordsBlock(records)}

## Coach reviews from this month
${reviewBlocks || "none run this month"}
`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="life-os-${month}.md"`,
    },
  });
}
