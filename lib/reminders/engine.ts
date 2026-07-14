// The reminder engine. Pure code: WHAT is due and WHEN is decided here from
// each user's own targets and reminders; the coach voice is fixed templates.
// The AI is not involved, and nothing here invents a number.

import { hhmmToMin, minToHHMM, targetBedtime, type SleepConfig } from "@/lib/sleep/sleep";
import type { DietWindow } from "@/lib/diet/config";

export const DEFAULT_TIMEZONE = "Europe/Vienna";

// A send is due from its scheduled minute until GRACE minutes after, so a
// 5-minute cron always catches it and a long outage does not dump stale
// reminders hours later. The send log still guarantees at most one per day.
export const GRACE_MIN = 20;

export type LocalNow = {
  date: string; // YYYY-MM-DD in the user's timezone
  minutes: number; // minutes since local midnight
  weekday: number; // 0 = Sunday
};

const WEEKDAY_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localNowIn(tz: string, now: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24; // "24" can appear at midnight
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
    weekday: WEEKDAY_NUM[get("weekday")] ?? 0,
  };
}

function inWindow(scheduledMin: number, nowMin: number): boolean {
  return nowMin >= scheduledMin && nowMin < scheduledMin + GRACE_MIN;
}

// ---------- automatic, system-derived reminders ----------

export type AutoKey = "auto:light" | "auto:winddown" | "auto:bed" | "auto:dinner";

export type AutoReminder = {
  key: AutoKey;
  label: string;
  timeMin: number; // scheduled minute, local
  message: string; // coach voice, template
};

// The full automatic set for a user, with times computed from their targets.
// Shown on the Reminders page and evaluated by the cron.
export function autoRemindersFor(
  sleepConfig: SleepConfig,
  dietWindow: DietWindow
): AutoReminder[] {
  const wake = hhmmToMin(sleepConfig.currentWake);
  const bedStr = targetBedtime(sleepConfig);
  const bed = hhmmToMin(bedStr);
  const out: AutoReminder[] = [
    {
      key: "auto:light",
      label: "Morning light",
      timeMin: (wake + 15) % 1440,
      message:
        "Light. Outside, 5 to 20 minutes, no sunglasses. The circadian clock is set now or not at all.",
    },
    {
      key: "auto:winddown",
      label: "Wind-down",
      timeMin: (bed - 60 + 1440) % 1440,
      message: `Wind-down. Screens down, book out. Bed at ${bedStr}. Hold the wake target tomorrow.`,
    },
    {
      key: "auto:bed",
      label: "Lights off",
      timeMin: bed,
      message:
        "Lights off. Book in hand. Phone on the charger across the room. The wake target stands either way.",
    },
  ];
  if (dietWindow.meal3) {
    out.push({
      key: "auto:dinner",
      label: "Dinner",
      timeMin: hhmmToMin(dietWindow.meal3),
      message: `Dinner at ${dietWindow.meal3}. Last real meal, protein first. Late food steals tomorrow's energy.`,
    });
  }
  return out;
}

export type AutoState = {
  morningLightDone: boolean;
  windDownDone: boolean;
};

// Which automatic reminders are due right now for this user.
export function dueAutoReminders(args: {
  autos: AutoReminder[];
  disabledKeys: string[];
  state: AutoState;
  now: LocalNow;
}): AutoReminder[] {
  const { autos, disabledKeys, state, now } = args;
  return autos.filter((a) => {
    if (disabledKeys.includes(a.key)) return false;
    if (!inWindow(a.timeMin, now.minutes)) return false;
    if (a.key === "auto:light" && state.morningLightDone) return false;
    if (a.key === "auto:winddown" && state.windDownDone) return false;
    // auto:bed (lights off) fires even when wind-down is logged: it is the
    // hard stop, and the last thing seen before the phone leaves the hand.
    return true;
  });
}

// ---------- campaign messages (Sleep Campaign 2.0) ----------
// Event-driven sends, deduped via reminder_sends like everything else.

export const WAKE_REPLY_WORD = "UP";

// Accept an UP reply as a wake only within a sane window around the target,
// so a stray evening reply never becomes a fabricated wake time.
export function wakeReplyAccepted(targetWakeMin: number, nowMin: number): boolean {
  let d = nowMin - targetWakeMin;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d >= -180 && d <= 360; // 3h early to 6h late
}

export function wakeLoggedMessage(wake: string, driftMin: number): string {
  const drift =
    driftMin === 0
      ? "on target"
      : driftMin > 0
        ? `${driftMin} min late`
        : `${-driftMin} min early`;
  return `Wake logged: ${wake} (${drift}). Now light: outside within the hour.`;
}

export function wakeRejectedMessage(targetWake: string): string {
  return `That does not read as a wake (target ${targetWake}). Reply UP within a few hours of waking and I log it.`;
}

export function recoveryMessage(driftMin: number, targetWake: string): string {
  return [
    `Rough night: ${driftMin} min past the ${targetWake} target. Run the recovery protocol, no drama:`,
    `1. Light now, 10 to 20 minutes outside.`,
    `2. No naps after 15:00.`,
    `3. Dinner on time, nothing late.`,
    `4. Tomorrow's wake target stands: ${targetWake}. One bad night does not move the campaign.`,
  ].join("\n");
}

export function advanceMessage(step: number, newWake: string, newBed: string): string {
  return `Step ${step}. You held it, so the target moves: wake ${newWake}, bed ${newBed}. Every reminder shifts with it. Same standard, new line.`;
}

// ---------- custom reminders ----------

export type CustomReminder = {
  id: string;
  label: string;
  time: string; // "HH:MM"
  repeat: "daily" | "weekdays" | "once";
  weekdays: number[]; // 0-6, for repeat === "weekdays"
  once_date: string | null; // for repeat === "once"
  channel: "telegram" | "push" | "both";
  enabled: boolean;
  linkedName?: string | null; // resolved system/goal name for the message
};

export function isCustomDue(r: CustomReminder, now: LocalNow): boolean {
  if (!r.enabled) return false;
  if (!/^\d{2}:\d{2}$/.test(r.time)) return false;
  if (!inWindow(hhmmToMin(r.time), now.minutes)) return false;
  if (r.repeat === "daily") return true;
  if (r.repeat === "weekdays") return r.weekdays.includes(now.weekday);
  if (r.repeat === "once") return r.once_date === now.date;
  return false;
}

export function customMessage(r: CustomReminder): string {
  const base = r.label.trim() || "Reminder";
  return r.linkedName ? `${base} (${r.linkedName})` : base;
}

// Human description for the manager UI.
export function repeatLabel(r: CustomReminder): string {
  if (r.repeat === "daily") return "daily";
  if (r.repeat === "once") return r.once_date ? `once, ${r.once_date}` : "once";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [...r.weekdays].sort().map((d) => names[d] ?? "?");
  return days.length ? days.join(" ") : "no days set";
}

export function fmtTimeMin(min: number): string {
  return minToHHMM(min);
}
