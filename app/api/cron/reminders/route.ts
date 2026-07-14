import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readSleepConfig,
  readSleepLog,
  computeSleepStats,
  stepNumber,
  targetBedtime,
  hhmmToMin,
  minToHHMM,
} from "@/lib/sleep/sleep";
import { readDietConfig } from "@/lib/diet/config";
import { addDays } from "@/lib/constants";
import {
  advanceMessage,
  autoRemindersFor,
  customMessage,
  dueAutoReminders,
  isCustomDue,
  localNowIn,
  recoveryMessage,
  wakeLoggedMessage,
  wakeRejectedMessage,
  wakeReplyAccepted,
  DEFAULT_TIMEZONE,
  type CustomReminder,
} from "@/lib/reminders/engine";
import { fetchTelegramUpdates, sendTelegram } from "@/lib/reminders/channels";
import { deliver, type DeliveryTargets } from "@/lib/reminders/deliver";
import {
  commitmentProgress,
  judgeCommitment,
  type CommitmentRow,
} from "@/lib/commitments/commitments";

export const maxDuration = 60;

type EntryRow = {
  user_id: string;
  date: string;
  system_statuses: Record<string, "done" | "floor" | "skip"> | null;
  module_logs: { sleep?: unknown } | null;
};

type SystemRow = {
  id: string;
  user_id: string;
  name: string;
  cadence: "daily" | "weekly";
  metric_type: string;
  target_per_week: number | null;
  unit: string | null;
};

// Hit by cron-job.org every minute or few. Single Telegram consumer: processes
// the bot inbox (link codes, UP wake replies) with an acknowledged cursor,
// then decides per user what is due (their times, their timezone), sends it,
// and never double-sends (unique insert into reminder_sends gates every send).
// The sleep campaign runs from here too: auto-advance and the recovery
// protocol are code-decided events, deduped the same way.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // ---- who can receive / reply ----
  const [{ data: channels }, { data: subs }] = await Promise.all([
    admin.from("user_channels").select("user_id, telegram_chat_id"),
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
  ]);
  const chatByUser = new Map(
    (channels ?? [])
      .filter((c) => c.telegram_chat_id)
      .map((c) => [c.user_id as string, c.telegram_chat_id as string])
  );
  const userByChat = new Map(
    [...chatByUser.entries()].map(([uid, chat]) => [chat, uid])
  );
  const subsByUser = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subs ?? []) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  const userIds = Array.from(new Set([...chatByUser.keys(), ...subsByUser.keys()]));

  const { data: users } = userIds.length
    ? await admin.from("users").select("id, name, coaching_prefs").in("id", userIds)
    : { data: [] as { id: string; name: string | null; coaching_prefs: Record<string, unknown> | null }[] };
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const tzOf = (uid: string) => {
    const prefs = (userById.get(uid)?.coaching_prefs ?? {}) as { timezone?: unknown };
    return typeof prefs.timezone === "string" ? prefs.timezone : DEFAULT_TIMEZONE;
  };

  // ---- Telegram inbox: the single acknowledged consumer ----
  let inboxHandled = 0;
  const { data: tgState } = await admin
    .from("telegram_state")
    .select("last_update_id")
    .eq("id", 1)
    .maybeSingle();
  const updates = await fetchTelegramUpdates(Number(tgState?.last_update_id ?? 0));
  if (Array.isArray(updates) && updates.length > 0) {
    let maxId = Number(tgState?.last_update_id ?? 0);
    for (const u of updates) {
      maxId = Math.max(maxId, u.update_id);
      const text = (u.message?.text ?? "").trim();
      const chatId = u.message?.chat?.id != null ? String(u.message.chat.id) : null;
      if (!text || !chatId) continue;

      // 1) Link codes: "/start CODE" (or the bare code).
      const startMatch = text.match(/^\/start\s+(\S+)$/i);
      const candidateCode = startMatch ? startMatch[1] : text;
      if (startMatch || /^[A-Z0-9]{6}$/.test(candidateCode)) {
        const { data: codeRow } = await admin
          .from("telegram_link_codes")
          .select("code, user_id")
          .eq("code", candidateCode.toUpperCase())
          .maybeSingle();
        if (codeRow) {
          await admin
            .from("user_channels")
            .upsert({ user_id: codeRow.user_id, telegram_chat_id: chatId });
          await admin.from("telegram_link_codes").delete().eq("code", codeRow.code);
          chatByUser.set(codeRow.user_id, chatId);
          userByChat.set(chatId, codeRow.user_id);
          await sendTelegram(
            chatId,
            "Linked. Your reminders land here now. Reply UP when you wake and I log it."
          );
          inboxHandled++;
          continue;
        }
        if (startMatch) {
          await sendTelegram(
            chatId,
            userByChat.has(chatId)
              ? "Already linked. Reply UP when you wake and I log it."
              : "Open Life OS, Reminders, Connect Telegram, then tap the link with your code."
          );
          inboxHandled++;
          continue;
        }
      }

      // 2) "UP": log the actual wake at the moment the message was sent.
      if (/^up[.! ]*$/i.test(text)) {
        const uid = userByChat.get(chatId);
        if (!uid) continue;
        const tz = tzOf(uid);
        const sentAt = u.message?.date ? new Date(u.message.date * 1000) : now;
        const local = localNowIn(tz, sentAt);
        const cfg = readSleepConfig(userById.get(uid)?.coaching_prefs);
        const targetMin = hhmmToMin(cfg.currentWake);

        if (!wakeReplyAccepted(targetMin, local.minutes)) {
          await sendTelegram(chatId, wakeRejectedMessage(cfg.currentWake));
          inboxHandled++;
          continue;
        }

        const wake = minToHHMM(local.minutes);
        const { data: existing } = await admin
          .from("entries")
          .select("id, module_logs")
          .eq("user_id", uid)
          .eq("date", local.date)
          .maybeSingle();
        const ml = (existing?.module_logs ?? {}) as Record<string, unknown>;
        const sleep = readSleepLog(ml.sleep);

        if (sleep.wake) {
          await sendTelegram(chatId, `Already logged: you woke at ${sleep.wake} today.`);
          inboxHandled++;
          continue;
        }

        const nextModuleLogs = { ...ml, sleep: { ...sleep, wake } };
        if (existing) {
          await admin
            .from("entries")
            .update({ module_logs: nextModuleLogs })
            .eq("id", existing.id);
        } else {
          await admin.from("entries").insert({
            user_id: uid,
            date: local.date,
            module_logs: nextModuleLogs,
          });
        }
        await sendTelegram(chatId, wakeLoggedMessage(wake, local.minutes - targetMin));
        inboxHandled++;
        continue;
      }

      // 3) Anything else from a linked chat: one-line help.
      if (userByChat.has(chatId)) {
        await sendTelegram(chatId, "Reply UP when you wake and I log it. Everything else lives in the app.");
        inboxHandled++;
      }
    }
    await admin
      .from("telegram_state")
      .upsert({ id: 1, last_update_id: maxId, updated_at: new Date().toISOString() });
  }

  if (userIds.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0, inboxHandled });
  }

  // ---- load the evaluation data (after inbox writes, so wakes count) ----
  const localByUser = new Map(userIds.map((uid) => [uid, localNowIn(tzOf(uid), now)]));
  const dates = [...localByUser.values()].map((l) => l.date).sort();
  const minDate = addDays(dates[0], -13); // sleep stats need a look-back window
  const maxDate = dates[dates.length - 1];

  const [
    { data: reminders },
    { data: systems },
    { data: goals },
    { data: entries },
    { data: activeCommitments },
    { data: friendships },
  ] = await Promise.all([
    admin.from("reminders").select("*").in("user_id", userIds).eq("enabled", true),
    admin
      .from("systems")
      .select("id, user_id, name, cadence, metric_type, target_per_week, unit")
      .in("user_id", userIds),
    admin.from("goals").select("id, user_id, title").in("user_id", userIds),
    admin
      .from("entries")
      .select("user_id, date, system_statuses, module_logs")
      .in("user_id", userIds)
      .gte("date", minDate)
      .lte("date", maxDate)
      .order("date", { ascending: false }),
    admin.from("commitments").select("*").in("user_id", userIds).eq("status", "active"),
    admin.from("friendships").select("user_id, friend_id").eq("status", "accepted"),
  ]);

  const sysName = new Map((systems ?? []).map((s) => [s.id as string, s.name as string]));
  const goalName = new Map((goals ?? []).map((g) => [g.id as string, g.title as string]));
  const entriesByUser = new Map<string, EntryRow[]>();
  for (const e of (entries ?? []) as EntryRow[]) {
    const list = entriesByUser.get(e.user_id) ?? [];
    list.push(e);
    entriesByUser.set(e.user_id, list);
  }

  let sent = 0;
  let checked = 0;
  const goneSubIds: string[] = [];
  const disableOnce: string[] = [];

  for (const uid of userIds) {
    const u = userById.get(uid);
    const local = localByUser.get(uid);
    if (!u || !local) continue;
    const prefs = (u.coaching_prefs ?? {}) as Record<string, unknown>;
    const targets: DeliveryTargets = {
      telegramChatId: chatByUser.get(uid) ?? null,
      pushSubs: subsByUser.get(uid) ?? [],
    };

    const sleepConfig = readSleepConfig(prefs);
    const own = entriesByUser.get(uid) ?? [];
    const todayEntry = own.find((e) => e.date === local.date);
    const todaySleep = readSleepLog(todayEntry?.module_logs?.sleep);

    // ---- automatic time-based reminders ----
    const remCfg = (prefs.reminders ?? {}) as { autoDisabled?: unknown };
    const disabledKeys = Array.isArray(remCfg.autoDisabled)
      ? remCfg.autoDisabled.filter((x): x is string => typeof x === "string")
      : [];
    const autos = dueAutoReminders({
      autos: autoRemindersFor(sleepConfig, readDietConfig(prefs).window),
      disabledKeys,
      state: {
        morningLightDone: todaySleep.morningLight,
        windDownDone: todaySleep.windDown,
      },
      now: local,
    });

    // ---- custom reminders ----
    const ownReminders: CustomReminder[] = ((reminders ?? []) as (CustomReminder & {
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
    const dueCustoms = ownReminders.filter((r) => isCustomDue(r, local));

    const work: {
      key: string;
      channel: "auto" | CustomReminder["channel"];
      body: string;
      onceId?: string;
      advanceTo?: { wake: string; startedOn: string };
    }[] = [
      ...autos.map((a) => ({ key: a.key as string, channel: "auto" as const, body: a.message })),
      ...dueCustoms.map((r) => ({
        key: `custom:${r.id}`,
        channel: r.channel,
        body: customMessage(r),
        onceId: r.repeat === "once" ? r.id : undefined,
      })),
    ];

    // ---- campaign events (code-decided, deduped like everything else) ----
    const wakes = own.map((e) => ({
      date: e.date,
      wake: readSleepLog(e.module_logs?.sleep).wake,
    }));
    const stats = computeSleepStats(sleepConfig, wakes);

    // Recovery protocol: today's wake landed 60+ minutes past target.
    if (todaySleep.wake) {
      const drift = hhmmToMin(todaySleep.wake) - hhmmToMin(sleepConfig.currentWake);
      if (drift > 60) {
        work.push({
          key: "auto:recovery",
          channel: "auto",
          body: recoveryMessage(drift, sleepConfig.currentWake),
        });
      }
    }

    // Auto-advance: the hold is earned, so the target moves by itself.
    if (stats.eligible) {
      const newWake = stats.nextWake;
      const newBed = targetBedtime({ ...sleepConfig, currentWake: newWake });
      work.push({
        key: "auto:advance",
        channel: "auto",
        body: advanceMessage(
          stepNumber({ ...sleepConfig, currentWake: newWake }),
          newWake,
          newBed
        ),
        advanceTo: { wake: newWake, startedOn: local.date },
      });
    }

    checked += work.length;

    for (const w of work) {
      // The double-send guard: only the run that wins this insert acts.
      const { error: dupe } = await admin.from("reminder_sends").insert({
        user_id: uid,
        key: w.key,
        sent_on: local.date,
      });
      if (dupe) continue;

      // Apply the config change BEFORE announcing it, and only once (the
      // send-log insert above is the lock).
      if (w.advanceTo) {
        const nextPrefs = {
          ...prefs,
          sleep: {
            ...sleepConfig,
            currentWake: w.advanceTo.wake,
            stepStartedOn: w.advanceTo.startedOn,
          },
        };
        const { error: advErr } = await admin
          .from("users")
          .update({ coaching_prefs: nextPrefs })
          .eq("id", uid);
        if (advErr) continue; // config failed: skip the announcement
      }

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

  // ---- commitment judgment: code decides, then the phones hear about it ----
  const systemsByUser = new Map<string, SystemRow[]>();
  for (const s of (systems ?? []) as SystemRow[]) {
    const list = systemsByUser.get(s.user_id) ?? [];
    list.push(s);
    systemsByUser.set(s.user_id, list);
  }
  const partnerOf = (uid: string): string | null => {
    for (const f of friendships ?? []) {
      if (f.user_id === uid) return f.friend_id as string;
      if (f.friend_id === uid) return f.user_id as string;
    }
    return null;
  };

  let judged = 0;
  for (const c of ((activeCommitments ?? []) as CommitmentRow[])) {
    const uid = c.user_id;
    const local = localByUser.get(uid);
    const u = userById.get(uid);
    if (!local || !u) continue;
    const prefs = (u.coaching_prefs ?? {}) as Record<string, unknown>;
    const own = (entriesByUser.get(uid) ?? []) as EntryRow[];

    const progress = commitmentProgress({
      c,
      entries: own,
      systems: systemsByUser.get(uid) ?? [],
      sleepConfig: readSleepConfig(prefs),
      today: local.date,
    });
    const verdict = judgeCommitment(progress, c.week_start, local.date);
    if (verdict === "active") continue;

    // The status transition is the send guard: only the run that flips the
    // row from 'active' announces the verdict.
    const { data: flipped } = await admin
      .from("commitments")
      .update({ status: verdict, judged_on: local.date })
      .eq("id", c.id)
      .eq("status", "active")
      .select("id");
    if (!flipped || flipped.length === 0) continue;
    judged++;

    const ownerChat = chatByUser.get(uid) ?? null;
    if (verdict === "passed") {
      if (ownerChat) {
        await sendTelegram(
          ownerChat,
          `Commitment kept: ${c.label} (${progress.count}/${progress.target}). That is the standard.`
        );
      }
      continue;
    }

    // Failed: tell the owner, and expose to the partner if the owner opted in.
    if (ownerChat) {
      await sendTelegram(
        ownerChat,
        `Commitment broken: ${c.label}. You got ${progress.count} of ${progress.target}. Debrief it before your next weekly review runs.`
      );
    }
    const expose = !!(
      (prefs.commitments as { exposePartner?: unknown } | undefined)?.exposePartner
    );
    const partnerId = partnerOf(uid);
    const partnerChat = partnerId ? chatByUser.get(partnerId) ?? null : null;
    if (expose && partnerChat) {
      const name = (u.name as string | null) ?? "Your partner";
      await sendTelegram(
        partnerChat,
        `${name} broke a commitment: ${c.label} (got ${progress.count} of ${progress.target}). Ask about it.`
      );
    }
  }

  // Housekeeping.
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

  return NextResponse.json({ checked, sent, inboxHandled, judged });
}
