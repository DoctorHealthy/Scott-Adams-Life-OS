"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { error: string };

export async function setTrendMetrics(keys: string[]): Promise<ActionResult> {
  if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
    return { error: "Invalid selection." };
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
  const trends = (prefs.trends ?? {}) as Record<string, unknown>;
  const next = { ...prefs, trends: { ...trends, metrics: keys.slice(0, 30) } };

  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/trends");
  return { ok: true };
}
