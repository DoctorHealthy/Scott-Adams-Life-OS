"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SystemStatus } from "@/lib/types";
import type { DietLogValue } from "@/lib/diet/log";
import type { SleepLog } from "@/lib/sleep/sleep";
import type { ExerciseLog } from "@/lib/exercise/exercise";
import type { MindLog } from "@/lib/mind/config";

export type ModuleLogs = {
  sleep: SleepLog;
  exercise: ExerciseLog;
  mind: MindLog;
};

export type EntryInput = {
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: DietLogValue;
  module_logs: ModuleLogs;
  one_line: string;
  reflection: string;
  tomorrow_next_action: string;
  is_private: boolean;
};

type ActionResult = { ok: true } | { error: string };

function emptyToNull(s: string): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

export async function saveEntry(input: EntryInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { error: "Invalid date." };
  }
  if (
    input.energy_1_10 != null &&
    (input.energy_1_10 < 1 || input.energy_1_10 > 10)
  ) {
    return { error: "Energy must be 1 to 10." };
  }

  const { error } = await supabase.from("entries").upsert(
    {
      user_id: user.id,
      date: input.date,
      energy_1_10: input.energy_1_10,
      system_statuses: input.system_statuses,
      meals: input.meals,
      module_logs: input.module_logs,
      one_line: emptyToNull(input.one_line),
      reflection: emptyToNull(input.reflection),
      tomorrow_next_action: emptyToNull(input.tomorrow_next_action),
      is_private: input.is_private,
    },
    { onConflict: "user_id,date" }
  );

  if (error) return { error: error.message };
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}

export async function deleteEntry(date: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date." };

  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  if (error) return { error: error.message };
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}
