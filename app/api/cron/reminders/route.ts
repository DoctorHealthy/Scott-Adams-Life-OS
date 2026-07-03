import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSleepConfig, readSleepLog } from "@/lib/sleep/sleep";
import { readDietConfig } from "@/lib/diet/config";
import {
  autoRemindersFor,
  customMessage,
  dueAutoReminders,
  isCustomDue,
  localNowIn,
  DEFAULT_TIMEZONE,
  type CustomReminder,
} from "@/lib/reminders/engine";
import { deliver, type DeliveryTargets } from "@/lib/reminders/deliver";

export const maxDuration = 60;

// Hit by cron-job.org every few minutes. Decides per user what is due (their
// times, their timezone), sends it, and never double-sends: an INSERT into
// reminder_sends with a unique (user, key, local-date) guards every send.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Who can receive anything at all?
  const [{ data: channels }, { data: subs }] = await Promise.all([
    admin.from("user_channels").select("user_id, telegram_chat_id"),
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
  ]);
  const chatByUser = new Map(
    (channels ?? [])
      .filter((c) => c.telegram_chat_id)
      .map((c) => [c.user_id as string, c.telegram_chat_id as string])
  );
  const subsByUser = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subs ?? []) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }
  const userIds = Array.from(new Set([...chatByUser.keys(), ...subsByUser.keys()]));
  if (userIds.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  const [{ data: users }, { data: reminders }, { data: systems }, { data: goals }] =
    await Promise.all([
      admin.from("users").select("id, name, coaching_prefs").in("id", userIds),
      admin
        .from("reminders")
        .select("*")
        .in("user_id", userIds)
        .eq("enabled", true),
      admin.from("systems").select("id, user_id, name").in("user_id", userIds),
      admin.from("goals").select("id, user_id, title").in("user_id", userIds),
    ]);

  const sysName = new Map((systems ?? []).map((s) => [s.id as string, s.name as string]));
  const goalName = new Map((goals ?? []).map((g) => [g.id as string, g.title as string]));

  // Local now per user, then today's entries for the dates involved.
  const now = new Date();
  const localByUser = new Map(
    (users ?? []).map((u) => {
      const prefs = (u.coaching_prefs ?? {}) as { timezone?: unknown };
      const tz = typeof prefs.timezone === "string" ? prefs.timezone : DEFAULT_TIMEZONE;
      return [u.id as string, localNowIn(tz, now)];
    })
  );
  const dates = Array.from(new Set([...localByUser.values()].map((l) => l.date)));
  const { data: entries } = await admin
    .from("entries")
    .select("user_id, date, module_logs")
    .in("user_id", userIds)
    .in("date", dates);
  const entryByUserDate = new Map(
    (entries ?? []).map((e) => [`${e.user_id}:${e.date}`, e])
  );

  let sent = 0;
  let checked = 0;
  const goneSubIds: string[] = [];
  const disableOnce: string[] = [];

  for (const u of users ?? []) {
    const uid = u.id as string;
    const local = localByUser.get(uid);
    if (!local) continue;
    const prefs = (u.coaching_prefs ?? {}) as Record<string, unknown>;
    const targets: DeliveryTargets = {
      telegramChatId: chatByUser.get(uid) ?? null,
      pushSubs: subsByUser.get(uid) ?? [],
    };

    // What is due: automatic first.
    const remCfg = (prefs.reminders ?? {}) as { autoDisabled?: unknown };
    const disabledKeys = Array.isArray(remCfg.autoDisabled)
      ? remCfg.autoDisabled.filter((x): x is string => typeof x === "string")
      : [];
    const todayEntry = entryByUserDate.get(`${uid}:${local.date}`);
    const sleepLog = readSleepLog(
      (todayEntry?.module_logs as { sleep?: unknown } | null)?.sleep
    );
    const autos = dueAutoReminders({
      autos: autoRemindersFor(
        readSleepConfig(prefs),
        readDietConfig(prefs).window
      ),
      disabledKeys,
      state: {
        morningLightDone: sleepLog.morningLight,
        windDownDone: sleepLog.windDown,
      },
      now: local,
    });

    const own: CustomReminder[] = ((reminders ?? []) as (CustomReminder & {
      user_id: string;
      linked_system_id: string | null;
      linked_goal_id: string | null;
      weekdays: unknown;
    })[])
      .filter((r) => r.user_id === uid)
      .map((r) => ({
        id: r.id,
        label: r.label,
        time: r.time,
        repeat: r.repeat,
        weekdays: Array.isArray(r.weekdays)
          ? (r.weekdays as number[]).filter((n) => Number.isInteger(n))
          : [],
        once_date: r.once_date,
        channel: r.channel,
        enabled: r.enabled,
        linkedName: r.linked_system_id
          ? sysName.get(r.linked_system_id) ?? null
          : r.linked_goal_id
            ? goalName.get(r.linked_goal_id) ?? null
            : null,
      }));

    const dueCustoms = own.filter((r) => isCustomDue(r, local));
    checked += autos.length + dueCustoms.length;

    const work: { key: string; channel: "auto" | CustomReminder["channel"]; body: string; onceId?: string }[] = [
      ...autos.map((a) => ({ key: a.key as string, channel: "auto" as const, body: a.message })),
      ...dueCustoms.map((r) => ({
        key: `custom:${r.id}`,
        channel: r.channel,
        body: customMessage(r),
        onceId: r.repeat === "once" ? r.id : undefined,
      })),
    ];

    for (const w of work) {
      // The double-send guard: only the run that wins this insert sends.
      const { error: dupe } = await admin.from("reminder_sends").insert({
        user_id: uid,
        key: w.key,
        sent_on: local.date,
      });
      if (dupe) continue; // already sent today (or insert failed): skip

      const res = await deliver({
        targets,
        channel: w.channel,
        title: "Life OS",
        body: w.body,
      });
      if (res.sent) sent++;
      goneSubIds.push(...res.goneSubIds);
      if (w.onceId) disableOnce.push(w.onceId);
    }
  }

  // Housekeeping: prune dead push endpoints, retire fired one-time reminders,
  // and expire stale Telegram link codes.
  if (goneSubIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", goneSubIds);
  }
  if (disableOnce.length > 0) {
    await admin.from("reminders").update({ enabled: false }).in("id", disableOnce);
  }
  await admin
    .from("telegram_link_codes")
    .delete()
    .lt("created_at", new Date(Date.now() - 3600_000).toISOString());

  return NextResponse.json({ checked, sent });
}
