// The single AI module. Swap this file to change provider; nothing else changes.
// Server-only. The API key never leaves the server.

export type GenerateInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

// Thrown when every model + retry is exhausted by overload/quota. The route
// turns this into a clean "Coach is busy, tap to retry" message.
export class CoachBusyError extends Error {
  constructor(message = "Coach is busy right now. Tap to retry.") {
    super(message);
    this.name = "CoachBusyError";
  }
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function backoffMs(attempt: number) {
  // 0.4s, 0.8s, 1.2s plus a little jitter so retries do not sync up.
  return 400 * (attempt + 1) + Math.floor(Math.random() * 200);
}

type Attempt =
  | { ok: true; text: string }
  | { ok: false; retryable: boolean; message: string };

async function callModel(
  model: string,
  key: string,
  body: string
): Promise<Attempt> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    // Network/timeout: worth a retry.
    return { ok: false, retryable: true, message: (e as Error).message };
  }

  if (res.ok) {
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) {
      return {
        ok: false,
        retryable: false,
        message: `Gemini blocked the request: ${json.promptFeedback.blockReason}`,
      };
    }
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
      "";
    if (!text.trim()) {
      // Empty body (can happen if output budget is consumed). Retry.
      return { ok: false, retryable: true, message: "Empty response." };
    }
    return { ok: true, text: text.trim() };
  }

  const errBody = (await res.text()).slice(0, 400);
  return {
    ok: false,
    retryable: RETRYABLE.has(res.status),
    message: `Gemini API error ${res.status}: ${errBody}`,
  };
}

export async function generate({
  system,
  prompt,
  temperature = 0.6,
  maxOutputTokens = 1024,
}: GenerateInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on the server.");

  const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallback = "gemini-2.5-flash-lite";
  const chain = primary === fallback ? [primary] : [primary, fallback];

  let lastMessage = "All models failed.";

  for (const model of chain) {
    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens,
    };
    // 2.5 models "think" by default, which can eat the whole output budget and
    // return empty text. We want tight, direct coaching, so turn thinking off.
    if (model.startsWith("gemini-2.5")) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await callModel(model, key, body);
      if (result.ok) return result.text;

      lastMessage = result.message;
      if (!result.retryable) {
        // Config-level failure (bad key, bad model, blocked). Retrying or
        // falling back will not help; surface it directly.
        throw new Error(result.message);
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt));
      }
    }
    // Exhausted retries for this model on retryable errors. Try the fallback.
  }

  // Every model was overloaded or rate-limited.
  throw new CoachBusyError(
    `Coach is busy right now. Tap to retry. (last: ${lastMessage.slice(0, 120)})`
  );
}
