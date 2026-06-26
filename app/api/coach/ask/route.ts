import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { ASK_TASK } from "@/lib/coach/prompts";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let question: string;
  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "Ask something." }, { status: 400 });
  }
  if (question.length > 1000) question = question.slice(0, 1000);

  let system: string;
  try {
    system = (await loadKnowledge()) + "\n\n" + ASK_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const prompt = `The user asks:\n\n"${question}"\n\nAnswer now, in persona.`;

  try {
    const text = await generate({ system, prompt, temperature: 0.6 });
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof CoachBusyError) {
      return NextResponse.json(
        { error: "Coach is busy right now. Tap to retry.", busy: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
