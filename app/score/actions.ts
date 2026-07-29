"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  readScoreConfig,
  type ExceptionKind,
  type ScoreConfig,
} from "@/lib/score/config";

type ActionResult = { ok: true } | { error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function loadPrefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ prefs: Record<string, unknown>; config: ScoreConfig }> {
  const { data } = await supabase
    .from("users")
    .select("coaching_prefs")
    .eq("id", userId)
    .single();
  const prefs = (data?.coaching_prefs ?? {}) as Record<string, unknown>;
  return { prefs, config: readScoreConfig(prefs) };
}

async function saveScoring(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  prefs: Record<string, unknown>,
  next: ScoreConfig
): Promise<ActionResult> {
  const { error } = await supabase
    .from("users")
    .update({ coaching_prefs: { ...prefs, scoring: next } })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

// Everything the settings form can change. Sanitized by readScoreConfig on save.
export type ScoreSettingsInput = {
  systemIds?: string[];
  cutoffHour?: number;
  sleepToleranceMin?: number;
  dailyFine?: number;
  weeklyFines?: { B: number; C: number; D: number; F: number };
  runsEnabled?: boolean;
  runsWaiverAllowed?: boolean;
  dailyRunKm?: { yellow: number; red: number; critical: number };
  weeklyRunKm?: { C: number; F: number };
  escalationEnabled?: boolean;
  notifyPartner?: boolean;
  fund?: { name: string; targetEur: number | null };
  rewardCatalog?: { green3: string; sWeek: string; perfectMonth: string };
};

export async function setScoreSettings(
  patch: ScoreSettingsInput
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const { prefs, config } = await loadPrefs(supabase, user.id);
  // Re-run the reader over the merged object so every field is validated and
  // defaults fill any gap.
  const next = readScoreConfig({ scoring: { ...config, ...patch } });
  return saveScoring(supabase, user.id, prefs, next);
}

export async function enableScoring(
  today: string,
  systemIds: string[]
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  if (!DATE_RE.test(today)) return { error: "Bad date." };
  if (!Array.isArray(systemIds) || systemIds.length === 0) {
    return { error: "Pick at least one system to score." };
  }
  const { prefs, config } = await loadPrefs(supabase, user.id);
  const next = readScoreConfig({
    scoring: {
      ...config,
      enabled: true,
      // Only stamp a start date the first time; re-enabling keeps history intact.
      startDate: config.startDate ?? today,
      systemIds,
    },
  });
  return saveScoring(supabase, user.id, prefs, next);
}

export async function disableScoring(): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const { prefs, config } = await loadPrefs(supabase, user.id);
  const next = readScoreConfig({ scoring: { ...config, enabled: false } });
  return saveScoring(supabase, user.id, prefs, next);
}

export async function declareException(
  from: string,
  to: string,
  reason: string,
  kind: ExceptionKind
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { error: "Bad date." };
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const k: ExceptionKind = kind === "bad_body" ? "bad_body" : "excused";
  const { prefs, config } = await loadPrefs(supabase, user.id);
  // Replace any identical range; keep the rest.
  const exceptions = config.exceptions.filter((e) => !(e.from === lo && e.to === hi));
  exceptions.push({ from: lo, to: hi, reason: reason.slice(0, 200), kind: k });
  const next = readScoreConfig({ scoring: { ...config, exceptions } });
  return saveScoring(supabase, user.id, prefs, next);
}

export async function removeException(from: string, to: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const { prefs, config } = await loadPrefs(supabase, user.id);
  const exceptions = config.exceptions.filter((e) => !(e.from === from && e.to === to));
  const next = readScoreConfig({ scoring: { ...config, exceptions } });
  return saveScoring(supabase, user.id, prefs, next);
}

// Clear the entertainment lock manually (its release is otherwise earned by
// green days). Resolves every pending lock row.
export async function liftLock(today: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const resolved = DATE_RE.test(today) ? today : null;
  const { error } = await supabase
    .from("ledger")
    .update({ status: "done", resolved_on: resolved })
    .eq("user_id", user.id)
    .eq("kind", "lock")
    .eq("status", "pending");
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

// A clean slate: waive every outstanding fine and run and lift the lock. The
// fund total (paid fines) is untouched. For starting a week fresh.
export async function resetAccountability(today: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const resolved = DATE_RE.test(today) ? today : null;
  const { error: e1 } = await supabase
    .from("ledger")
    .update({ status: "waived" })
    .eq("user_id", user.id)
    .in("kind", ["fine", "run"])
    .eq("status", "pending");
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase
    .from("ledger")
    .update({ status: "done", resolved_on: resolved })
    .eq("user_id", user.id)
    .eq("kind", "lock")
    .eq("status", "pending");
  if (e2) return { error: e2.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

// Add a fine or run by hand (the cron auto-logs the rest at cutoff; this is for
// adjustments).
export async function addManualLedger(input: {
  kind: "fine" | "run";
  amountEur?: number;
  distanceKm?: number;
  label: string;
  today: string;
}): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  if (!DATE_RE.test(input.today)) return { error: "Bad date." };
  const isFine = input.kind === "fine";
  const amount = isFine ? Math.round((input.amountEur ?? 0) * 100) / 100 : null;
  const distance = !isFine ? Math.round((input.distanceKm ?? 0) * 10) / 10 : null;
  if (isFine && (!amount || amount <= 0)) return { error: "Amount must be positive." };
  if (!isFine && (!distance || distance <= 0)) return { error: "Distance must be positive." };
  const { error } = await supabase.from("ledger").insert({
    user_id: user.id,
    date: input.today,
    source: "manual",
    kind: input.kind,
    amount_eur: amount,
    distance_km: distance,
    label:
      input.label.trim().slice(0, 120) ||
      (isFine ? "Manual fine" : "Manual run"),
    status: "pending",
  });
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

// ---- ledger obligations (RLS guarantees own-rows only) ----

export async function markLedgerDone(
  id: string,
  today: string
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const resolved = DATE_RE.test(today) ? today : null;
  const { error } = await supabase
    .from("ledger")
    .update({ status: "done", resolved_on: resolved })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

export async function waiveLedger(id: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("ledger")
    .update({ status: "waived" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}

export async function logPayout(
  amountEur: number,
  label: string,
  today: string
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated." };
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return { error: "Amount must be positive." };
  }
  if (!DATE_RE.test(today)) return { error: "Bad date." };
  const { error } = await supabase.from("ledger").insert({
    user_id: user.id,
    date: today,
    source: "manual",
    kind: "payout",
    amount_eur: Math.round(amountEur * 100) / 100,
    label: label.trim().slice(0, 120) || "Fund payout",
    status: "done",
    resolved_on: today,
  });
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/weekly");
  revalidatePath("/partner");
  return { ok: true };
}
