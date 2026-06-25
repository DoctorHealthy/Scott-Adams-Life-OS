// The single AI module. Swap this file to change provider; nothing else changes.
// Server-only. The API key never leaves the server.

export type GenerateInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generate({
  system,
  prompt,
  temperature = 0.6,
  maxOutputTokens = 1024,
}: GenerateInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on the server.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens };
  // 2.5 models "think" by default, which can eat the whole output budget and
  // return empty text. We want tight, direct coaching, so turn thinking off.
  if (model.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
  } catch (e) {
    throw new Error(`Could not reach Gemini: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text();
    // Surface the real status so a bad/expired key is obvious, not a mystery.
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${json.promptFeedback.blockReason}`);
  }

  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response.");
  return text.trim();
}
