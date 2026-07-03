"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true; status?: string } | { error: string };

export async function addFriend(email: string): Promise<ActionResult> {
  const trimmed = (email ?? "").trim();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_friend", {
    friend_email: trimmed,
  });
  if (error) return { error: error.message };

  const res = data as { ok?: boolean; status?: string; error?: string };
  if (res?.error) return { error: res.error };
  revalidatePath("/partner");
  return { ok: true, status: res?.status };
}

export async function respondFriend(
  id: string,
  accept: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("friend_id", user.id); // only the recipient accepts
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) return { error: error.message };
  }
  revalidatePath("/partner");
  return { ok: true };
}

export async function removeFriend(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/partner");
  return { ok: true };
}

export async function setHiddenSystems(ids: string[]): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
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
  const sharing = (prefs.sharing ?? {}) as Record<string, unknown>;
  const next = {
    ...prefs,
    sharing: { ...sharing, hiddenSystems: ids.slice(0, 50) },
  };

  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/partner");
  return { ok: true };
}

export async function setHiddenGoals(ids: string[]): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
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
  const sharing = (prefs.sharing ?? {}) as Record<string, unknown>;
  const next = {
    ...prefs,
    sharing: { ...sharing, hiddenGoals: ids.slice(0, 100) },
  };

  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/partner");
  return { ok: true };
}
