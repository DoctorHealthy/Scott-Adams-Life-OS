"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeTelegramLink,
  createReminder,
  deleteReminder,
  removePushSubscription,
  savePushSubscription,
  sendTestNow,
  setAutoDisabled,
  setReminderEnabled,
  startTelegramLink,
  unlinkTelegram,
  updateReminder,
  type ReminderInput,
} from "@/app/reminders/actions";
import { repeatLabel } from "@/lib/reminders/engine";
import type { ReminderRow } from "@/app/reminders/page";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY_FORM: ReminderInput = {
  label: "",
  time: "18:00",
  repeat: "daily",
  weekdays: [],
  once_date: null,
  channel: "telegram",
  linked_system_id: null,
  linked_goal_id: null,
  enabled: true,
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function RemindersManager({
  telegramLinked,
  pushCount,
  vapidPublicKey,
  autos,
  autoDisabled,
  reminders,
  systems,
  goals,
}: {
  telegramLinked: boolean;
  pushCount: number;
  vapidPublicKey: string | null;
  autos: { key: string; label: string; time: string; message: string }[];
  autoDisabled: string[];
  reminders: ReminderRow[];
  systems: { id: string; name: string }[];
  goals: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Telegram link flow state
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  // Auto toggles
  const [disabled, setDisabled] = useState<string[]>(autoDisabled);

  // Editor state: null = closed, "new" = creating, else the reminder id.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ReminderInput>({ ...EMPTY_FORM });

  function note(m: string) {
    setMsg(m);
    setError(null);
  }
  function fail(e: string) {
    setError(e);
    setMsg(null);
  }

  async function run<T extends { ok?: true } | { error: string }>(
    fn: () => Promise<T>,
    okMsg?: string
  ) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if ("error" in res) fail(res.error);
    else {
      if (okMsg) note(okMsg);
      router.refresh();
    }
    return res;
  }

  // ---------- channel handlers ----------

  async function beginLink() {
    setBusy(true);
    setError(null);
    const res = await startTelegramLink();
    setBusy(false);
    if ("error" in res) return fail(res.error);
    setLinkCode(res.code);
    setBotUsername(res.botUsername);
  }

  async function enablePush() {
    setError(null);
    if (!vapidPublicKey) {
      return fail("Push keys are not configured on the server yet.");
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return fail(
        "Push is not available in this browser. On iPhone, install the app to the home screen first, then enable push from inside it."
      );
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return fail("Notification permission was not granted.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return fail("Subscription came back incomplete. Try again.");
      }
      await run(
        () =>
          savePushSubscription({
            endpoint: json.endpoint!,
            p256dh: json.keys!.p256dh!,
            auth: json.keys!.auth!,
          }),
        "Push enabled on this device."
      );
    } catch (e) {
      fail(
        (e as Error).message ||
          "Could not subscribe. Note: push needs the production app (or the installed PWA), not the dev server."
      );
    }
  }

  async function disablePushHere() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      note("Push disabled on this device.");
      router.refresh();
    } catch {
      fail("Could not unsubscribe this device.");
    }
  }

  async function toggleAuto(key: string) {
    const next = disabled.includes(key)
      ? disabled.filter((k) => k !== key)
      : [...disabled, key];
    setDisabled(next);
    await setAutoDisabled(next);
    router.refresh();
  }

  // ---------- editor handlers ----------

  function openNew() {
    setForm({ ...EMPTY_FORM, channel: telegramLinked ? "telegram" : "push" });
    setEditing("new");
  }

  function openEdit(r: ReminderRow) {
    setForm({
      label: r.label,
      time: r.time,
      repeat: r.repeat,
      weekdays: r.weekdays,
      once_date: r.once_date,
      channel: r.channel,
      linked_system_id: r.linked_system_id,
      linked_goal_id: r.linked_goal_id,
      enabled: r.enabled,
    });
    setEditing(r.id);
  }

  async function saveForm() {
    const res = await run(
      () => (editing === "new" ? createReminder(form) : updateReminder(editing!, form)),
      "Saved."
    );
    if (!("error" in res)) setEditing(null);
  }

  const linkValue = form.linked_system_id
    ? `s:${form.linked_system_id}`
    : form.linked_goal_id
      ? `g:${form.linked_goal_id}`
      : "";

  return (
    <div className="stack">
      {/* ---------- channels ---------- */}
      <div className="card">
        <div className="block-title">Channels</div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 160, fontSize: 14 }}>
              Telegram{" "}
              <span className="muted" style={{ fontSize: 12 }}>
                {telegramLinked ? "linked" : "not linked"} (the reliable channel)
              </span>
            </span>
            {telegramLinked ? (
              <button
                className="btn btn-auto"
                onClick={() => run(() => unlinkTelegram(), "Telegram unlinked.")}
                disabled={busy}
              >
                Unlink
              </button>
            ) : (
              <button className="btn btn-primary btn-auto" onClick={beginLink} disabled={busy}>
                Connect Telegram
              </button>
            )}
          </div>

          {linkCode && !telegramLinked ? (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
              }}
            >
              <p style={{ margin: "0 0 8px" }}>
                1. Open{" "}
                {botUsername ? (
                  <a
                    className="link"
                    href={`https://t.me/${botUsername}?start=${linkCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    t.me/{botUsername}
                  </a>
                ) : (
                  "your bot in Telegram"
                )}{" "}
                and tap Start (or send: <code>/start {linkCode}</code>).
              </p>
              <p style={{ margin: "0 0 10px" }}>2. Then finish here:</p>
              <button
                className="btn btn-primary btn-auto"
                onClick={() =>
                  run(() => completeTelegramLink(linkCode), "Telegram linked.").then(
                    (r) => {
                      if (!("error" in r)) setLinkCode(null);
                    }
                  )
                }
                disabled={busy}
              >
                I sent it, complete the link
              </button>
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 160, fontSize: 14 }}>
              Push{" "}
              <span className="muted" style={{ fontSize: 12 }}>
                {pushCount > 0 ? `${pushCount} device${pushCount > 1 ? "s" : ""}` : "not enabled"}{" "}
                (bonus; needs the installed app on iPhone)
              </span>
            </span>
            <button className="btn btn-auto" onClick={enablePush} disabled={busy}>
              Enable on this device
            </button>
            {pushCount > 0 ? (
              <button className="btn btn-ghost btn-auto" onClick={disablePushHere} disabled={busy}>
                Disable here
              </button>
            ) : null}
          </div>

          <div>
            <button
              className="btn btn-auto"
              onClick={() => run(() => sendTestNow(), "Test sent. Check your phone.")}
              disabled={busy}
            >
              Send me a test now
            </button>
          </div>
        </div>
      </div>

      {msg ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {msg}
        </p>
      ) : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      {/* ---------- automatic reminders ---------- */}
      <div className="card">
        <div className="block-title">Automatic (from your targets)</div>
        <p className="muted" style={{ margin: "6px 0 4px", fontSize: 13 }}>
          Times move with your targets. Already-logged items are skipped.
        </p>
        <div className="review-rows">
          {autos.map((a) => (
            <div
              key={a.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {a.label} <span className="muted" style={{ fontWeight: 400 }}>at {a.time}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.message}
                </div>
              </div>
              <label className="check-row" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={!disabled.includes(a.key)}
                  onChange={() => toggleAuto(a.key)}
                />
                <span className="muted" style={{ fontSize: 12 }}>on</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- custom reminders ---------- */}
      <div className="card">
        <div className="card-head-row">
          <span className="block-title">Your reminders</span>
          <button className="btn btn-ghost btn-auto" onClick={openNew}>
            + Add reminder
          </button>
        </div>

        {reminders.length === 0 && editing !== "new" ? (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            None yet. Add one; it fires at your time, on your days.
          </p>
        ) : null}

        {reminders.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              borderBottom: "1px solid var(--border)",
              opacity: r.enabled ? 1 : 0.55,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {r.label}{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  at {r.time}, {repeatLabel(r)}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                via {r.channel}
                {r.linked_system_id
                  ? ` · ${systems.find((s) => s.id === r.linked_system_id)?.name ?? "system"}`
                  : r.linked_goal_id
                    ? ` · ${goals.find((g) => g.id === r.linked_goal_id)?.title ?? "goal"}`
                    : ""}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-auto"
              onClick={() =>
                run(() => setReminderEnabled(r.id, !r.enabled))
              }
              disabled={busy}
            >
              {r.enabled ? "Pause" : "Resume"}
            </button>
            <button className="btn btn-ghost btn-auto" onClick={() => openEdit(r)}>
              Edit
            </button>
          </div>
        ))}

        {editing ? (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div className="form-row">
              <div className="field">
                <label>Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Training session"
                />
              </div>
              <div className="field">
                <label>Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Repeat</label>
                <select
                  value={form.repeat}
                  onChange={(e) =>
                    setForm({ ...form, repeat: e.target.value as ReminderInput["repeat"] })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Specific weekdays</option>
                  <option value="once">Once</option>
                </select>
              </div>
              <div className="field">
                <label>Channel</label>
                <select
                  value={form.channel}
                  onChange={(e) =>
                    setForm({ ...form, channel: e.target.value as ReminderInput["channel"] })
                  }
                >
                  <option value="telegram">Telegram</option>
                  <option value="push">Push</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            {form.repeat === "weekdays" ? (
              <div className="field">
                <label>Days</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAY_NAMES.map((d, i) => {
                    const on = form.weekdays.includes(i);
                    return (
                      <button
                        key={d}
                        className={`btn btn-auto${on ? " btn-primary" : ""}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            weekdays: on
                              ? form.weekdays.filter((x) => x !== i)
                              : [...form.weekdays, i],
                          })
                        }
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {form.repeat === "once" ? (
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.once_date ?? ""}
                  onChange={(e) => setForm({ ...form, once_date: e.target.value || null })}
                />
              </div>
            ) : null}

            <div className="field">
              <label>Link to (optional)</label>
              <select
                value={linkValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({
                    ...form,
                    linked_system_id: v.startsWith("s:") ? v.slice(2) : null,
                    linked_goal_id: v.startsWith("g:") ? v.slice(2) : null,
                  });
                }}
              >
                <option value="">Nothing</option>
                {systems.map((s) => (
                  <option key={s.id} value={`s:${s.id}`}>
                    System: {s.name}
                  </option>
                ))}
                {goals.map((g) => (
                  <option key={g.id} value={`g:${g.id}`}>
                    Goal: {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="btn-row">
              <button className="btn btn-primary btn-auto" onClick={saveForm} disabled={busy}>
                {editing === "new" ? "Add reminder" : "Save changes"}
              </button>
              <button className="btn btn-auto" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              {editing !== "new" ? (
                <button
                  className="btn btn-ghost btn-auto btn-danger"
                  onClick={() => {
                    if (!window.confirm("Delete this reminder?")) return;
                    run(() => deleteReminder(editing!), "Deleted.").then(() =>
                      setEditing(null)
                    );
                  }}
                  disabled={busy}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
