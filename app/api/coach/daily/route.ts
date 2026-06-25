import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate, CoachBusyError } from "@/lib/ai/provider";
import { buildDailyReviewPrompt, DAILY_REVIEW_TASK } from "@/lib/coach/prompts";
import type { Entry, System } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let date: string;
  try {
    const body = await request.json();
    date = String(body?.date ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  // Load the exact data. The model reads these; it never computes them.
  const [{ data: profile }, { data: systems }, { data: entry }, { data: recent }] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("systems")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("entries")
        .select("date, energy_1_10, system_statuses")
        .eq("user_id", user.id)
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(7),
    ]);

  if (!entry) {
    return NextResponse.json(
      { error: "No check-in saved for that day. Save the check-in first." },
      { status: 400 }
    );
  }

  let system: string;
  try {
    system = (await loadKnowledge()) + "\n\n" + DAILY_REVIEW_TASK;
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load the coach knowledge base: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const prompt = buildDailyReviewPrompt({
    profile: profile ?? null,
    systems: (systems as System[]) ?? [],
    entry: entry as Entry,
    recent: recent ?? [],
    date,
  });

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
