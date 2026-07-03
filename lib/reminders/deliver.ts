// One delivery call for any reminder: routes to Telegram and/or Web Push.
// "auto" = the reliability rule from the spec: Telegram when linked (the
// guaranteed channel), otherwise push. Reports dead push endpoints so the
// caller can prune them.

import { sendPush, sendTelegram, type PushSub } from "./channels";

export type Channel = "telegram" | "push" | "both" | "auto";

export type DeliveryTargets = {
  telegramChatId: string | null;
  pushSubs: (PushSub & { id: string })[];
};

export async function deliver(args: {
  targets: DeliveryTargets;
  channel: Channel;
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: boolean; goneSubIds: string[] }> {
  const { targets, channel, title, body, url } = args;
  const goneSubIds: string[] = [];
  let sent = false;

  const wantTelegram =
    channel === "telegram" ||
    channel === "both" ||
    (channel === "auto" && !!targets.telegramChatId);
  const wantPush =
    channel === "push" ||
    channel === "both" ||
    (channel === "auto" && !targets.telegramChatId);

  if (wantTelegram && targets.telegramChatId) {
    const res = await sendTelegram(targets.telegramChatId, body);
    if (res.ok) sent = true;
  }

  if (wantPush && targets.pushSubs.length > 0) {
    for (const sub of targets.pushSubs) {
      const res = await sendPush(sub, { title, body, url: url ?? "/today" });
      if (res.ok) sent = true;
      else if (res.gone) goneSubIds.push(sub.id);
    }
  }

  return { sent, goneSubIds };
}
