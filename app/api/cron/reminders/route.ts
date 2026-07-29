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
  weekStartOf,
  weekEndOf,
  type CommitmentRow,
} from "@/lib/commitments/commitments";
import {
  readScoreConfig,
  exceptionKindOn,
  eur,
  type ScoreConfig,
} from "@/lib/score/config";
import {
  dayScore,
  dayGrade,
  isGreenDay,
  weekScore,
  consequencesForDay,
  consequencesForWeek,
  escalateFine,
  escalateRun,
  weeklySystemResults,
  type Consequence,
  type DayScore,
  type WeekScore,
  type ScoredSystemLike,
} from "@/lib/score/score";

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
  domain: string | null;
  cadence: "daily" | "weekly";
  metric_type: string;
  target_per_week: number | null;
  unit: string | null;
};

type LedgerRow = {
  id: string;
  user_id: string;
  date: string;
  source: string;
  kind: string;
  amount_eur: number | null;
  distance_km: number | null;
  label: string;
  status: string;
  release_rule: string | null;
  resolved_on: string | null;
};

// ---- scoring Telegram text (kept here; the engine stays UI/channel-free) ----
function scoreFineRunParts(cons: Consequence[], fundName: string): string[] {
  const parts: string[] = [];
  for (const c of cons) {
    if (c.kind === "fine") parts.push(`${eur(c.amountEur)} to the ${fundName}`);
    else if (c.kind === "run")
      parts.push(
        c.waived ? `${c.distanceKm} km run waived (bad-body day)` : `${c.distanceKm} km run`
      );
    else if (c.kind === "reward") parts.push("reward earned");
  }
  return parts;
}

function dailyOwnerText(
  date: string,
  ds: DayScore,
  grade: string,
  cons: Consequence[],
  config: ScoreConfig
): string {
  if (grade === "Perfect") {
    return `${date}: ${ds.points}/${ds.max}, Perfect. Clean day, no penalty.`;
  }
  const parts = scoreFineRunParts(cons, config.fund.name);
  const lock = cons.find((c) => c.kind === "lock");
  let msg = `${date}: ${ds.points}/${ds.max}, ${grade}.`;
  if (parts.length) msg += ` Auto: ${parts.join(", ")}.`;
  if (lock) msg += ` ${lock.label}`;
  msg += " Decided. Mark it done in the app, or reply PAID for fines.";
  return msg;
}

function weeklyOwnerText(
  wkMon: string,
  ws: WeekScore,
  cons: Consequence[],
  config: ScoreConfig
): string {
  const parts = scoreFineRunParts(cons, config.fund.name);
  const lock = cons.find((c) => c.kind === "lock");
  let msg = `Week of ${wkMon}: ${ws.points}/${ws.max}, grade ${ws.grade}.`;
  if (ws.criticalDays > 0)
    msg += ` ${ws.criticalDays} zero-day${ws.criticalDays > 1 ? "s" : ""} pulled it down.`;
  if (parts.length) msg += ` Auto: ${parts.join(", ")}.`;
  if (lock) msg += ` ${lock.label}`;
  return msg;
}

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

      // 2b) "PAID": settle all outstanding fines (the money enters the fund).
      if (/^paid[.! ]*$/i.test(text)) {
        const uid = userByChat.get(chatId);
        if (!uid) continue;
        const { data: pend } = await admin
          .from("ledger")
          .select("id, amount_eur")
          .eq("user_id", uid)
          .eq("kind", "fine")
          .eq("status", "pending");
        const ids = (pend ?? []).map((r) => r.id as string);
        if (ids.length === 0) {
          await sendTelegram(chatId, "No fines outstanding.");
        } else {
          const total = (pend ?? []).reduce((a, r) => a + Number(r.amount_eur ?? 0), 0);
          const paidOn = localNowIn(tzOf(uid), now).date;
          await admin
            .from("ledger")
            .update({ status: "done", resolved_on: paidOn })
            .in("id", ids);
          await sendTelegram(
            chatId,
            `Marked ${ids.length} fine${ids.length > 1 ? "s" : ""} paid, ${eur(total)} into the fund.`
          );
        }
        inboxHandled++;
        continue;
      }

      // 2c) "BED"/"DOWN": log tonight's bedtime. Attributed to the wake day so
      // bed and wake land on ONE entry (duration needs both): an evening bed
      // (>= 18:00) belongs to tomorrow's sleep; an after-midnight bed to today.
      if (/^(bed|down)[.! ]*$/i.test(text)) {
        const uid = userByChat.get(chatId);
        if (!uid) continue;
        const tz = tzOf(uid);
        const sentAt = u.message?.date ? new Date(u.message.date * 1000) : now;
        const local = localNowIn(tz, sentAt);
        const targetDate = local.minutes >= 18 * 60 ? addDays(local.date, 1) : local.date;
        const bed = minToHHMM(local.minutes);

        const { data: existing } = await admin
          .from("entries")
          .select("id, module_logs")
          .eq("user_id", uid)
          .eq("date", targetDate)
          .maybeSingle();
        const ml = (existing?.module_logs ?? {}) as Record<string, unknown>;
        const sleep = readSleepLog(ml.sleep);
        if (sleep.bed) {
          await sendTelegram(chatId, `Already logged: in bed at ${sleep.bed}.`);
          inboxHandled++;
          continue;
        }
        const nextModuleLogs = { ...ml, sleep: { ...sleep, bed } };
        if (existing) {
          await admin.from("entries").update({ module_logs: nextModuleLogs }).eq("id", existing.id);
        } else {
          await admin.from("entries").insert({ user_id: uid, date: targetDate, module_logs: nextModuleLogs });
        }
        await sendTelegram(chatId, `In bed at ${bed}, logged. Reply UP when you wake and I close the night.`);
        inboxHandled++;
        continue;
      }

      // 3) Anything else from a linked chat: one-line help.
      if (userByChat.has(chatId)) {
        await sendTelegram(chatId, "UP when you wake, BED when you turn in, PAID to settle fines. Everything else lives in the app.");
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
      .select("id, user_id, name, domain, cadence, metric_type, target_per_week, unit")
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

  // ---- accountability scoring judgment (R6) ----
  // Code decides the grade and consequences at each user's personal cutoff,
  // then the ledger records them and the phones hear about it. Exactly-once via
  // reminder_sends keys 'score:day:<date>' / 'score:week:<monday>' with sent_on
  // set to the JUDGED date, so re-runs on any later day never re-judge.
  const { data: ledgerRows } = await admin
    .from("ledger")
    .select(
      "id, user_id, date, source, kind, amount_eur, distance_km, label, status, release_rule, resolved_on"
    )
    .in("user_id", userIds)
    .order("date", { ascending: false });
  const ledgerByUser = new Map<string, LedgerRow[]>();
  for (const r of (ledgerRows ?? []) as LedgerRow[]) {
    const list = ledgerByUser.get(r.user_id) ?? [];
    list.push(r);
    ledgerByUser.set(r.user_id, list);
  }

  let scored = 0;
  for (const uid of userIds) {
    const u = userById.get(uid);
    const local = localByUser.get(uid);
    if (!u || !local) continue;
    const prefs = (u.coaching_prefs ?? {}) as Record<string, unknown>;
    const config = readScoreConfig(prefs);
    if (!config.enabled || config.systemIds.length === 0) continue;
    if (local.minutes < config.cutoffHour * 60) continue; // before the day's cutoff

    const sleepConfig = readSleepConfig(prefs);
    const sysList = systemsByUser.get(uid) ?? [];
    const scoredSystems: ScoredSystemLike[] = config.systemIds
      .map((id) => sysList.find((s) => s.id === id))
      .filter((s): s is SystemRow => !!s)
      .map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        metric_type: s.metric_type,
        cadence: s.cadence,
        target_per_week: s.target_per_week,
        unit: s.unit,
      }));
    if (scoredSystems.length === 0) continue;

    const own = (entriesByUser.get(uid) ?? []) as EntryRow[];
    const entryByDate = new Map(own.map((e) => [e.date, e]));
    const scoreFor = (date: string): DayScore =>
      dayScore({ date, entry: entryByDate.get(date), systems: scoredSystems, sleepConfig, config });

    const myLedger = ledgerByUser.get(uid) ?? [];
    const ownerChat = chatByUser.get(uid) ?? null;
    const partnerId = partnerOf(uid);
    const partnerChat = partnerId ? chatByUser.get(partnerId) ?? null : null;
    const ownerName = (u.name as string | null) ?? "Your partner";

    // The most recent strong (A/S) week resets escalation streaks.
    const { data: resetRows } = await admin
      .from("reminder_sends")
      .select("sent_on")
      .eq("user_id", uid)
      .eq("key", "score:reset")
      .order("sent_on", { ascending: false })
      .limit(1);
    const lastReset: string | null = (resetRows?.[0]?.sent_on as string) ?? null;

    const priorMagnitudes = (kind: "fine" | "run", source: string): number[] =>
      myLedger
        .filter(
          (r) => r.kind === kind && r.source === source && (!lastReset || r.date > lastReset)
        )
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map((r) =>
          kind === "fine" ? Number(r.amount_eur ?? 0) : Number(r.distance_km ?? 0)
        );

    const toRows = (cons: Consequence[], judgedDate: string, source: "day" | "week") => {
      const rows: Record<string, unknown>[] = [];
      for (const c of cons) {
        if (c.kind === "fine") {
          const amount = escalateFine(c.amountEur, priorMagnitudes("fine", source), config);
          const up = amount !== c.amountEur;
          rows.push({
            user_id: uid,
            date: judgedDate,
            source,
            kind: "fine",
            amount_eur: amount,
            label: up ? `${c.label} Escalated to ${eur(amount)}.` : c.label,
            status: "pending",
          });
        } else if (c.kind === "run") {
          const km = escalateRun(c.distanceKm, priorMagnitudes("run", source), config);
          const up = km !== c.distanceKm;
          rows.push({
            user_id: uid,
            date: judgedDate,
            source,
            kind: "run",
            distance_km: km,
            label: c.waived ? c.label : up ? `${km} km run (escalated).` : c.label,
            status: c.waived ? "waived" : "pending",
          });
        } else if (c.kind === "lock") {
          rows.push({
            user_id: uid,
            date: judgedDate,
            source,
            kind: "lock",
            label: c.label,
            status: "pending",
            release_rule: c.releaseRule,
          });
        } else if (c.kind === "reward") {
          rows.push({
            user_id: uid,
            date: judgedDate,
            source,
            kind: "reward",
            label: c.label,
            status: "done",
          });
        }
      }
      return rows;
    };

    // Consecutive green days ending at a date (skipping excused days, which
    // never break a streak). Used to release entertainment locks.
    const trailingGreenDates = (endDate: string): string[] => {
      const out: string[] = [];
      for (let i = 0; i < 21; i++) {
        const d = addDays(endDate, -i);
        if (config.startDate && d < config.startDate) break;
        const s = scoreFor(d);
        if (s.excused) continue;
        if (isGreenDay(s.points, s.max)) out.push(d);
        else break;
      }
      return out;
    };

    const releaseLocks = async (asOf: string) => {
      const greens = trailingGreenDates(asOf);
      for (const l of myLedger) {
        if (l.kind !== "lock" || l.status !== "pending") continue;
        const need = l.release_rule === "green3" ? 3 : 1;
        if (greens.length >= need && greens[need - 1] > l.date) {
          await admin
            .from("ledger")
            .update({ status: "done", resolved_on: asOf })
            .eq("id", l.id);
          l.status = "done";
        }
      }
    };

    // ----- daily: judge the day that just ended at the cutoff -----
    const dayToJudge = addDays(local.date, -1);
    if (!config.startDate || dayToJudge >= config.startDate) {
      const key = `score:day:${dayToJudge}`;
      const { error: dupe } = await admin
        .from("reminder_sends")
        .insert({ user_id: uid, key, sent_on: dayToJudge });
      if (!dupe) {
        const ds = scoreFor(dayToJudge);
        const grade = dayGrade(ds.points, ds.max);
        const exKind = exceptionKindOn(config, dayToJudge);

        if (exKind === "excused") {
          if (ownerChat)
            await sendTelegram(
              ownerChat,
              `${dayToJudge}: excused. No penalty, dropped from the week.`
            );
        } else {
          const cons = consequencesForDay(grade, config, exKind === "bad_body");
          const rows = toRows(cons, dayToJudge, "day");
          if (rows.length > 0) {
            await admin.from("ledger").insert(rows);
            for (const r of rows) myLedger.push(r as unknown as LedgerRow);
          }
          if (isGreenDay(ds.points, ds.max)) await releaseLocks(dayToJudge);

          if (ownerChat)
            await sendTelegram(ownerChat, dailyOwnerText(dayToJudge, ds, grade, cons, config));

          if (config.notifyPartner && partnerChat) {
            const owed = cons.reduce((a, c) => (c.kind === "fine" ? a + c.amountEur : a), 0);
            const runs = cons.filter(
              (c): c is Extract<Consequence, { kind: "run" }> => c.kind === "run" && !c.waived
            );
            const hasLock = cons.some((c) => c.kind === "lock");
            if (owed > 0 || runs.length > 0 || hasLock) {
              await sendTelegram(
                partnerChat,
                `${ownerName} yesterday: ${ds.points}/${ds.max} ${grade}.` +
                  (owed > 0 ? ` ${eur(owed)} to pay.` : "") +
                  (runs.length > 0
                    ? ` ${runs.map((r) => `${r.distanceKm} km`).join(" + ")} to run.`
                    : "") +
                  (hasLock ? " Entertainment locked." : "") +
                  " You verify."
              );
            }
          }
        }
        scored++;
      }
    }

    // ----- weekly: judge the most recent completed week (any day past cutoff) -----
    const wkMon = addDays(weekStartOf(local.date), -7);
    const wkSun = weekEndOf(wkMon);
    if (!config.startDate || wkSun >= config.startDate) {
      const key = `score:week:${wkMon}`;
      const { error: dupe } = await admin
        .from("reminder_sends")
        .insert({ user_id: uid, key, sent_on: wkMon });
      if (!dupe) {
        const from = config.startDate && config.startDate > wkMon ? config.startDate : wkMon;
        const days: DayScore[] = [];
        for (let d = wkMon; d <= wkSun; d = addDays(d, 1)) {
          if (d >= from) days.push(scoreFor(d));
        }
        const ws = weekScore(wkMon, days);
        if (ws.grade === "A" || ws.grade === "S") {
          await admin
            .from("reminder_sends")
            .insert({ user_id: uid, key: "score:reset", sent_on: wkMon });
        }
        const cons = consequencesForWeek(ws.grade, config);
        const rows = toRows(cons, wkMon, "week");
        // A weekly lock must clear on a green day in the FOLLOWING week, so date
        // it at the judged week's end; releases then count only later greens.
        for (const r of rows) if (r.kind === "lock") r.date = wkSun;

        // Weekly-tracked scored systems are judged ONCE here (never daily). Each
        // one short of its weekly target gets a single fine.
        const wsMissed = weeklySystemResults(scoredSystems, own, from, wkSun).filter(
          (w) => w.target != null && !w.met
        );
        for (const w of wsMissed) {
          rows.push({
            user_id: uid,
            date: wkMon,
            source: "week",
            kind: "fine",
            amount_eur: config.dailyFine,
            label: `${w.name}: ${w.count}/${w.target} this week. ${eur(config.dailyFine)} to the ${config.fund.name}.`,
            status: "pending",
          });
        }

        if (rows.length > 0) await admin.from("ledger").insert(rows);

        const wsOwed = wsMissed.length * config.dailyFine;
        if (ownerChat) {
          const suffix = wsMissed.length
            ? ` Weekly habits missed: ${wsMissed.map((w) => `${w.name} ${w.count}/${w.target}`).join(", ")}.`
            : "";
          await sendTelegram(ownerChat, weeklyOwnerText(wkMon, ws, cons, config) + suffix);
        }
        if (config.notifyPartner && partnerChat) {
          const owed =
            cons.reduce((a, c) => (c.kind === "fine" ? a + c.amountEur : a), 0) + wsOwed;
          const hasRun = cons.some((c) => c.kind === "run");
          const hasLock = cons.some((c) => c.kind === "lock");
          if (owed > 0 || hasRun || hasLock) {
            await sendTelegram(
              partnerChat,
              `${ownerName} last week: ${ws.points}/${ws.max}, grade ${ws.grade}.` +
                (owed > 0 ? ` ${eur(owed)} to pay.` : "") +
                (hasLock ? " Entertainment locked." : "") +
                " You verify."
            );
          }
        }
        scored++;
      }
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

  return NextResponse.json({ checked, sent, inboxHandled, judged, scored });
}
