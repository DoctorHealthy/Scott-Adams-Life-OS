import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge } from "@/lib/coach/knowledge";
import { generate } from "@/lib/ai/provider";
import { buildOnboardingPrompt, ONBOARDING_TASK } from "@/lib/coach/prompts";
import {
  buildProfileBriefFallback,
  fallbackProposal,
  SYSTEM_ORDER,
  type Intake,
  type Proposal,
  type ProposedGoal,
  type ProposedSystem,
} from "@/lib/onboarding/onboarding";

function sanitizeProposal(raw: unknown, intake: Intake): Proposal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { systems?: unknown; goals?: unknown; profileBrief?: unknown };
  if (!Array.isArray(o.systems)) return null;

  const fallback = fallbackProposal(intake);
  const systems: ProposedSystem[] = SYSTEM_ORDER.map((domain) => {
    const found = (o.systems as ProposedSystem[]).find(
      (s) => s && s.domain === domain
    );
    const fb = fallback.systems.find((s) => s.domain === domain)!;
    if (!found) return fb;
    return {
      domain,
      name: typeof found.name === "string" && found.name.trim() ? found.name.trim() : fb.name,
      rule: typeof found.rule === "string" ? found.rule : fb.rule,
      floor: typeof found.floor === "string" ? found.floor : fb.floor,
      ceiling: typeof found.ceiling === "string" ? found.ceiling : fb.ceiling,
      anchor: typeof found.anchor === "string" ? found.anchor : fb.anchor,
    };
  });

  const LINKS = new Set(["manual", "sleep_wake", "training_sessions", "diet_protein"]);
  const goals: ProposedGoal[] = (Array.isArray(o.goals) ? (o.goals as ProposedGoal[]) : [])
    .filter((g) => g && typeof g.title === "string" && g.title.trim())
    .slice(0, 3)
    .map((g) => ({
      title: g.title.trim(),
      why: typeof g.why === "string" ? g.why.trim().split(/\s+/)[0] ?? "" : "",
      quarter: ([1, 2, 3, 4].includes(Number(g.quarter))
        ? Number(g.quarter)
        : Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
      link: LINKS.has(g.link) ? g.link : "manual",
    }));

  return {
    systems,
    goals: goals.length ? goals : fallback.goals,
    profileBrief:
      typeof o.profileBrief === "string" && o.profileBrief.trim()
        ? o.profileBrief.trim()
        : buildProfileBriefFallback(intake),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let intake: Intake;
  try {
    const body = await request.json();
    intake = body?.intake as Intake;
    if (!intake || typeof intake !== "object") throw new Error("bad");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Summarize the intake for the model (their own words, structured).
  const summary = buildProfileBriefFallback(intake);

  try {
    const system = (await loadKnowledge()) + "\n\n" + ONBOARDING_TASK;
    const text = await generate({
      system,
      prompt: buildOnboardingPrompt(summary),
      temperature: 0.7,
      maxOutputTokens: 2400,
    });
    // Strip accidental code fences, then parse.
    const cleaned = text.replace(/^```(json)?/m, "").replace(/```\s*$/m, "").trim();
    const parsed = sanitizeProposal(JSON.parse(cleaned), intake);
    if (parsed) return NextResponse.json({ proposal: parsed, ai: true });
  } catch {
    // Fall through to the fallback. Onboarding never blocks on the AI.
  }

  return NextResponse.json({ proposal: fallbackProposal(intake), ai: false });
}
