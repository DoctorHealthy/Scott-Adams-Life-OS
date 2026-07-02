"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { error: string };

export async function setWeeklyReviewDay(day: number): Promise<ActionResult> {
  if (typeof day !== "number" || day < 0 || day > 6) {
    return { error: "Invalid day." };
  }
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
  const review = (prefs.review ?? {}) as Record<string, unknown>;
  const next = { ...prefs, review: { ...review, weeklyDay: Math.floor(day) } };

  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/weekly");
  revalidatePath("/today");
  return { ok: true };
}
