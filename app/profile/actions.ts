"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileInput = {
  name: string;
  age: number | null;
  sex: "male" | "female";
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: "sedentary" | "light" | "moderate" | "high" | "athlete";
  timezone: string;
  coachingStyle: "hardcore" | "firm" | "gentle";
};

type ActionResult = { ok: true } | { error: string };

const ACTIVITY = new Set(["sedentary", "light", "moderate", "high", "athlete"]);
const STYLES = new Set(["hardcore", "firm", "gentle"]);

function num(n: number | null, lo: number, hi: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (!ACTIVITY.has(input.activityLevel)) return { error: "Invalid activity level." };
  if (!STYLES.has(input.coachingStyle)) return { error: "Invalid coaching style." };
  const sex = input.sex === "female" ? "female" : "male";

  // Validate the timezone before storing it (a bad tz would break reminders).
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    return { error: "That timezone is not recognized." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("coaching_prefs")
    .eq("id", user.id)
    .single();
  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const intake = (prefs.intake ?? {}) as Record<string, unknown>;

  const coaching_prefs = {
    ...prefs,
    timezone: input.timezone,
    intake: { ...intake, sex, coachingStyle: input.coachingStyle },
  };

  const { error } = await supabase
    .from("users")
    .update({
      name: input.name.trim() || null,
      age: num(input.age, 10, 120),
      height_cm: num(input.heightCm, 80, 260),
      weight_kg: num(input.weightKg, 25, 400),
      activity_level: input.activityLevel,
      coaching_prefs,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Targets, reminders, and the coach all read these; refresh broadly.
  revalidatePath("/profile");
  revalidatePath("/today");
  revalidatePath("/trends");
  return { ok: true };
}
