import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import RemindersManager from "@/components/RemindersManager";
import { readSleepConfig } from "@/lib/sleep/sleep";
import { readDietConfig } from "@/lib/diet/config";
import { autoRemindersFor, fmtTimeMin } from "@/lib/reminders/engine";
import type { CustomReminder } from "@/lib/reminders/engine";

export type ReminderRow = CustomReminder & {
  linked_system_id: string | null;
  linked_goal_id: string | null;
};

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: reminders },
    { data: channel },
    { data: subs },
    { data: systems },
    { data: goals },
  ] = await Promise.all([
    supabase.from("users").select("coaching_prefs").eq("id", user.id).single(),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .order("time", { ascending: true }),
    supabase
      .from("user_channels")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", user.id),
    supabase
      .from("systems")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("goals")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  const prefs = (profile?.coaching_prefs ?? {}) as Record<string, unknown>;
  const remCfg = (prefs.reminders ?? {}) as { autoDisabled?: unknown };
  const autoDisabled = Array.isArray(remCfg.autoDisabled)
    ? remCfg.autoDisabled.filter((x): x is string => typeof x === "string")
    : [];

  const autos = autoRemindersFor(
    readSleepConfig(prefs),
    readDietConfig(prefs).window
  ).map((a) => ({
    key: a.key,
    label: a.label,
    time: fmtTimeMin(a.timeMin),
    message: a.message,
  }));

  const rows: ReminderRow[] = ((reminders ?? []) as (ReminderRow & { weekdays: unknown })[]).map(
    (r) => ({
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
      linked_system_id: r.linked_system_id,
      linked_goal_id: r.linked_goal_id,
    })
  );

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Reminders</div>
            <h1 style={{ marginTop: 6 }}>Nudges that land on your phone</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Telegram is the reliable channel; push is the bonus. All timing is
              computed from your own targets and times.
            </p>
          </div>

          <RemindersManager
            telegramLinked={!!channel?.telegram_chat_id}
            pushCount={(subs ?? []).length}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
            autos={autos}
            autoDisabled={autoDisabled}
            reminders={rows}
            systems={(systems ?? []) as { id: string; name: string }[]}
            goals={(goals ?? []) as { id: string; title: string }[]}
          />
        </div>
      </main>
    </div>
  );
}
