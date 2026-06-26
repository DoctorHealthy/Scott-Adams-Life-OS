"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleConfig } from "@/lib/schedule/schedule";

type ActionResult = { ok: true } | { error: string };

export async function saveScheduleConfig(
  config: ScheduleConfig
): Promise<ActionResult> {
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
  const next = { ...prefs, schedule: config };

  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}
