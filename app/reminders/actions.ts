"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  findTelegramStart,
  sendTelegram,
  telegramBotUsername,
} from "@/lib/reminders/channels";
import { deliver } from "@/lib/reminders/deliver";

type ActionResult = { ok: true } | { error: string };

export type ReminderInput = {
  label: string;
  time: string; // "HH:MM"
  repeat: "daily" | "weekdays" | "once";
  weekdays: number[];
  once_date: string | null;
  channel: "telegram" | "push" | "both";
  linked_system_id: string | null;
  linked_goal_id: string | null;
  enabled: boolean;
};

function validate(input: ReminderInput): string | null {
  if (!input.label?.trim()) return "Give the reminder a label.";
  if (!/^\d{2}:\d{2}$/.test(input.time)) return "Time must be HH:MM.";
  if (input.repeat === "weekdays" && input.weekdays.length === 0)
    return "Pick at least one weekday.";
  if (input.repeat === "once" && !input.once_date)
    return "Pick the date for a one-time reminder.";
  return null;
}

function toRow(input: ReminderInput, userId: string) {
  return {
    user_id: userId,
    label: input.label.trim().slice(0, 200),
    time: input.time,
    repeat: input.repeat,
    weekdays: input.weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    once_date: input.repeat === "once" ? input.once_date : null,
    channel: input.channel,
    linked_system_id: input.linked_system_id,
    linked_goal_id: input.linked_system_id ? null : input.linked_goal_id,
    enabled: input.enabled,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createReminder(input: ReminderInput): Promise<ActionResult> {
  const bad = validate(input);
  if (bad) return { error: bad };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase.from("reminders").insert(toRow(input, user.id));
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function updateReminder(
  id: string,
  input: ReminderInput
): Promise<ActionResult> {
  const bad = validate(input);
  if (bad) return { error: bad };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("reminders")
    .update(toRow(input, user.id))
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function setReminderEnabled(
  id: string,
  enabled: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("reminders")
    .update({ enabled })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

// Enable/disable the automatic system-derived reminders.
export async function setAutoDisabled(keys: string[]): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("users")
    .select("coaching_prefs")
    .eq("id", user.id)
    .single();
  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const reminders = (prefs.reminders ?? {}) as Record<string, unknown>;
  const next = {
    ...prefs,
    reminders: { ...reminders, autoDisabled: keys.slice(0, 10) },
  };
  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: next })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

// ---------- Telegram linking ----------

export async function startTelegramLink(): Promise<
  { ok: true; code: string; botUsername: string | null } | { error: string }
> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);
  const { error } = await supabase
    .from("telegram_link_codes")
    .insert({ code, user_id: user.id });
  if (error) return { error: error.message };

  return { ok: true, code, botUsername: await telegramBotUsername() };
}

export async function completeTelegramLink(code: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  // The code must belong to this user and be fresh (cron expires them at 1h).
  const { data: row } = await supabase
    .from("telegram_link_codes")
    .select("code")
    .eq("user_id", user.id)
    .eq("code", code)
    .maybeSingle();
  if (!row) return { error: "Link code expired. Start again." };

  const found = await findTelegramStart(code);
  if (!found) {
    return {
      error:
        "No message found yet. Open the bot, send the /start message, then try again.",
    };
  }
  if ("error" in found) return { error: found.error };

  const { error } = await supabase
    .from("user_channels")
    .upsert({ user_id: user.id, telegram_chat_id: found.chatId });
  if (error) return { error: error.message };

  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);
  await sendTelegram(
    found.chatId,
    "Linked. Your reminders land here now. The standard is the standard."
  );
  revalidatePath("/reminders");
  return { ok: true };
}

export async function unlinkTelegram(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("user_channels")
    .update({ telegram_chat_id: null })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

// ---------- Web Push subscriptions ----------

export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<ActionResult> {
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return { error: "Invalid subscription." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      { onConflict: "endpoint" }
    );
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

// ---------- test send ----------

export async function sendTestNow(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const [{ data: channel }, { data: subs }] = await Promise.all([
    supabase
      .from("user_channels")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id),
  ]);

  const targets = {
    telegramChatId: channel?.telegram_chat_id ?? null,
    pushSubs: subs ?? [],
  };
  if (!targets.telegramChatId && targets.pushSubs.length === 0) {
    return { error: "No channel connected yet. Link Telegram or enable push first." };
  }

  const res = await deliver({
    targets,
    channel: "both",
    title: "Life OS",
    body: "Test reminder. The pipes work. Now go run the system.",
  });
  if (!res.sent) return { error: "Send failed on every channel. Check the keys." };

  if (res.goneSubIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", res.goneSubIds);
  }
  return { ok: true };
}
