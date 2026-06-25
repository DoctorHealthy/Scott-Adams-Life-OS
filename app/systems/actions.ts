"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MetricType } from "@/lib/types";

export type SystemInput = {
  name: string;
  domain: string;
  rule: string;
  floor: string;
  ceiling: string;
  metric_type: MetricType;
  anchor: string;
  schedule_block: string;
  active: boolean;
};

type ActionResult = { ok: true } | { error: string };

function emptyToNull(s: string): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  return { supabase, user };
}

export async function createSystem(input: SystemInput): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  if (!input.name?.trim()) return { error: "Name is required." };

  // Append to the end of the active list.
  const { count } = await supabase
    .from("systems")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase.from("systems").insert({
    user_id: user.id,
    name: input.name.trim(),
    domain: input.domain || null,
    rule: emptyToNull(input.rule),
    floor: emptyToNull(input.floor),
    ceiling: emptyToNull(input.ceiling),
    metric_type: input.metric_type,
    anchor: emptyToNull(input.anchor),
    schedule_block: emptyToNull(input.schedule_block),
    active: input.active,
    sort_order: count ?? 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/systems");
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateSystem(
  id: string,
  input: SystemInput
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  if (!input.name?.trim()) return { error: "Name is required." };

  const { error } = await supabase
    .from("systems")
    .update({
      name: input.name.trim(),
      domain: input.domain || null,
      rule: emptyToNull(input.rule),
      floor: emptyToNull(input.floor),
      ceiling: emptyToNull(input.ceiling),
      metric_type: input.metric_type,
      anchor: emptyToNull(input.anchor),
      schedule_block: emptyToNull(input.schedule_block),
      active: input.active,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/systems");
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setSystemActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("systems")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/systems");
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSystem(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("systems")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/systems");
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}
