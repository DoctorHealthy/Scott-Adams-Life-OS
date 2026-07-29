"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDateStr } from "@/lib/constants";
import { weekStartOf } from "@/lib/commitments/commitments";

type ActionResult = { ok: true } | { error: string };

// Sprints are no longer capped at 3; a generous backstop only prevents runaway
// spam. Distinct from the standing accountability system.
const MAX_ACTIVE_PER_WEEK = 12;

export async function createCommitment(input: {
  kind: "system_count" | "wake_hold";
  systemId: string | null;
  target: number;
  toleranceMin?: number;
}): Promise<ActionResult> {
  const target = Math.round(Number(input.target));
  if (!Number.isFinite(target) || target < 1 || target > 21) {
    return { error: "Target must be between 1 and 21." };
  }
  if (input.kind === "system_count" && !input.systemId) {
    return { error: "Pick a system." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const week = weekStartOf(localDateStr());

  const { count } = await supabase
    .from("commitments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("week_start", week);
  if ((count ?? 0) >= MAX_ACTIVE_PER_WEEK) {
    return { error: "That is a lot of sprints for one week. Keep it to what you can actually hold." };
  }

  // Build the label from real data so it always matches what code will judge.
  let label: string;
  if (input.kind === "wake_hold") {
    const tol = Math.round(Number(input.toleranceMin ?? 30));
    label = `Wake within ${tol} min of target, ${target} of 7 days`;
  } else {
    const { data: sys } = await supabase
      .from("systems")
      .select("id, name, unit, metric_type")
      .eq("id", input.systemId!)
      .eq("user_id", user.id)
      .single();
    if (!sys) return { error: "System not found." };
    const unit =
      sys.metric_type === "number" ? (sys.unit ? ` ${sys.unit}` : " times") : "x";
    label =
      sys.metric_type === "number"
        ? `${sys.name}: ${target}${unit} this week`
        : `${sys.name} ${target}x this week`;
  }

  const { error } = await supabase.from("commitments").insert({
    user_id: user.id,
    week_start: week,
    kind: input.kind,
    system_id: input.kind === "system_count" ? input.systemId : null,
    target,
    tolerance_min: input.kind === "wake_hold" ? Math.round(Number(input.toleranceMin ?? 30)) : null,
    label,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/weekly");
  revalidatePath("/today");
  return { ok: true };
}

// Deleting is allowed only while the commitment is still active and the week
// is current: no erasing history after a verdict.
export async function deleteCommitment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const week = weekStartOf(localDateStr());
  const { error, count } = await supabase
    .from("commitments")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("week_start", week);
  if (error) return { error: error.message };
  if (!count) return { error: "Only this week's active commitments can be removed." };
  revalidatePath("/weekly");
  revalidatePath("/today");
  return { ok: true };
}

export async function saveDebrief(id: string, text: string): Promise<ActionResult> {
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 20) {
    return { error: "Write the real why and the exact reversal. One line will not do." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error, count } = await supabase
    .from("commitments")
    .update({ debrief: trimmed.slice(0, 2000) }, { count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "failed");
  if (error) return { error: error.message };
  if (!count) return { error: "No failed commitment found to debrief." };
  revalidatePath("/weekly");
  return { ok: true };
}

export async function setExposePartner(expose: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("users")
    .select("coaching_prefs")
    .eq("id", user.id)
    .single();
  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const commitments = (prefs.commitments ?? {}) as Record<string, unknown>;
  const next = {
    ...prefs,
    commitments: { ...commitments, exposePartner: !!expose },
  };
  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/weekly");
  return { ok: true };
}
