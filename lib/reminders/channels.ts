// Delivery channels behind one small interface, so a channel can be added or
// swapped without touching the engine. Server-only.

import webpush from "web-push";

const TG_API = "https://api.telegram.org";

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  return t;
}

// ---------- Telegram ----------

export async function sendTelegram(
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TG_API}/bot${botToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const json = (await res.json()) as { ok?: boolean; description?: string };
    return json.ok ? { ok: true } : { ok: false, error: json.description ?? "send failed" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function telegramBotUsername(): Promise<string | null> {
  try {
    const res = await fetch(`${TG_API}/bot${botToken()}/getMe`);
    const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    return json.ok ? (json.result?.username ?? null) : null;
  } catch {
    return null;
  }
}

// Scan pending bot updates for "/start <code>" messages. Used by the on-demand
// link completion (no webhook to configure; works locally and deployed).
export async function findTelegramStart(
  code: string
): Promise<{ chatId: string } | { error: string } | null> {
  try {
    const res = await fetch(`${TG_API}/bot${botToken()}/getUpdates?timeout=0&allowed_updates=%5B%22message%22%5D`);
    if (res.status === 409) {
      return { error: "The bot has a webhook set; remove it to use link codes." };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      result?: { message?: { text?: string; chat?: { id?: number } } }[];
    };
    if (!json.ok || !Array.isArray(json.result)) return null;
    // Newest first, so a retyped code wins.
    for (const u of [...json.result].reverse()) {
      const text = (u.message?.text ?? "").trim();
      const chat = u.message?.chat?.id;
      if (!chat) continue;
      if (text === `/start ${code}` || text === code) {
        return { chatId: String(chat) };
      }
    }
    return null;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Web Push (VAPID) ----------

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@wexlerllc.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return true;
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };

// Returns gone=true when the subscription is dead and should be deleted.
export async function sendPush(
  sub: PushSub,
  payload: { title: string; body: string; url?: string }
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  if (!ensureVapid()) return { ok: false, error: "VAPID keys not configured." };
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { ok: false, gone: true };
    return { ok: false, error: (e as Error).message };
  }
}
