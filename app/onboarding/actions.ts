"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  SYSTEM_ORDER,
  type Intake,
  type Proposal,
} from "@/lib/onboarding/onboarding";

type ActionResult = { ok: true } | { error: string };

const CONSTRAINT_KEYS: Record<string, string> = {
  "lactose-free": "lactose_free",
  "gluten-free": "gluten_free",
  vegetarian: "vegetarian",
  vegan: "vegan",
  "low added sugar": "low_added_sugar",
  "no alcohol": "no_alcohol",
};

export async function completeOnboarding(
  intake: Intake,
  proposal: Proposal
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Refuse to double-run: onboarding seeds, it never duplicates.
  const { count } = await supabase
    .from("systems")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) {
    return { error: "This account already has systems. Edit them under Systems." };
  }

  // ---- profile row: stats in columns, everything else in coaching_prefs ----
  const constraints: Record<string, boolean> = {};
  for (const c of intake.dietConstraints) {
    constraints[CONSTRAINT_KEYS[c] ?? c.replace(/\s+/g, "_")] = true;
  }
  if (intake.injuries.trim()) constraints.injuries_note = true;

  const { data: profileRow } = await supabase
    .from("users")
    .select("coaching_prefs")
    .eq("id", user.id)
    .single();
  const prefs = (profileRow?.coaching_prefs ?? {}) as Record<string, unknown>;

  const coaching_prefs = {
    ...prefs,
    onboarded: true,
    profile_brief: proposal.profileBrief,
    intake: {
      sex: intake.sex,
      energyBaseline: intake.energyBaseline,
      workHours: intake.workHours,
      fixedCommitments: intake.fixedCommitments,
      freeHours: intake.freeHours,
      dietNotes: intake.dietNotes,
      weightGoal: intake.weightGoal,
      fitnessLevel: intake.fitnessLevel,
      fitnessLikes: intake.fitnessLikes,
      injuries: intake.injuries,
      coachingStyle: intake.coachingStyle,
      failureModes: intake.failureModes,
    },
    sleep: {
      startWake: intake.currentWake,
      currentWake: intake.currentWake,
      goalWake: intake.goalWake,
      stepMinutes: 30,
      sleepHours: intake.sleepHours,
      stepStartedOn: null,
    },
    exercise: {
      sessionsTarget: Math.min(7, Math.max(1, Math.round(intake.sessionsTarget))),
    },
    schedule: {
      morningBlock: [
        "Morning light within 30 to 60 min of waking",
        "One block on what matters most while energy is fresh",
      ],
      slotWhenFree: [],
      fixedRocks: intake.fixedCommitments
        ? intake.fixedCommitments
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      eisenhower: [],
    },
    mind: {
      vision: intake.vision.trim() || "Define where you are going. Edit this in Mind.",
      pinnedReframes: [],
    },
    // Diet targets stay code-computed from the stats (no overrides).
  };

  const { error: userError } = await supabase
    .from("users")
    .update({
      name: intake.name.trim() || null,
      age: intake.age,
      height_cm: intake.heightCm,
      weight_kg: intake.weightKg,
      activity_level: intake.activityLevel,
      constraints,
      coaching_prefs,
    })
    .eq("id", user.id);
  if (userError) return { error: userError.message };

  // ---- systems, in canonical day order ----
  const rows = SYSTEM_ORDER.map((domain, i) => {
    const p = proposal.systems.find((s) => s.domain === domain)!;
    return {
      user_id: user.id,
      name: p.name,
      domain,
      rule: p.rule || null,
      floor: p.floor || null,
      ceiling: p.ceiling || null,
      metric_type: "binary" as const,
      anchor: p.anchor || null,
      schedule_block: null,
      active: true,
      sort_order: i,
    };
  });
  const { data: inserted, error: sysError } = await supabase
    .from("systems")
    .insert(rows)
    .select("id, domain");
  if (sysError) return { error: sysError.message };

  // ---- seed goals, linked to the new systems by domain ----
  const byDomain = new Map((inserted ?? []).map((s) => [s.domain as string, s.id]));
  const linkDomain: Record<string, string | null> = {
    sleep_wake: "Sleep",
    training_sessions: "Exercise",
    diet_protein: "Diet",
    manual: null,
  };
  const year = new Date().getFullYear();
  const goalRows = proposal.goals.map((g) => {
    const domain = linkDomain[g.link];
    const linked = domain ? byDomain.get(domain) ?? null : null;
    return {
      user_id: user.id,
      title: g.title,
      why: g.why,
      target_year: year,
      target_quarter: g.quarter,
      progress_type: linked ? ("auto" as const) : ("manual" as const),
      linked_system_id: linked,
      manual_progress: 0,
      milestones: [],
      notes: "",
      status: "active" as const,
    };
  });
  if (goalRows.length > 0) {
    const { error: goalError } = await supabase.from("goals").insert(goalRows);
    if (goalError) return { error: goalError.message };
  }

  revalidatePath("/today");
  revalidatePath("/systems");
  revalidatePath("/goals");
  return { ok: true };
}
