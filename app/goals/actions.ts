"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rowFromGoal, type Goal } from "@/lib/goals/goals";

type ActionResult = { ok: true } | { error: string };

// Persist one year's goals: upsert everything provided, remove what the user
// deleted. Scoped to the year so other years are never touched.
export async function saveGoalsForYear(
  year: number,
  goals: Goal[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const rows = goals
    .filter((g) => g.year === year)
    .map((g) => rowFromGoal(g, user.id));

  if (rows.length > 0) {
    const { error } = await supabase.from("goals").upsert(rows);
    if (error) return { error: error.message };
  }

  const keepIds = rows.map((r) => r.id);
  let del = supabase
    .from("goals")
    .delete()
    .eq("user_id", user.id)
    .eq("target_year", year);
  if (keepIds.length > 0) {
    del = del.not("id", "in", `(${keepIds.join(",")})`);
  }
  const { error: delError } = await del;
  if (delError) return { error: delError.message };

  revalidatePath("/today");
  revalidatePath("/goals");
  return { ok: true };
}
