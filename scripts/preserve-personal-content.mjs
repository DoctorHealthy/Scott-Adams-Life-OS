// One-time, idempotent: copy the ORIGINAL personal defaults (Ondra warm-up,
// ankle prehab, German-lesson rocks, the personal meal catalog, the old
// morning block) into an account's own coaching_prefs, but ONLY where that
// account has nothing saved. Run this for Mark's account BEFORE relying on the
// new generic defaults, so his content survives the de-personalization.
//
// Run with: node --env-file=.env.local scripts/preserve-personal-content.mjs your@email
//
// Safe to re-run: keys that already exist are never overwritten.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the Supabase secret key.");
  process.exit(1);
}
const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/preserve-personal-content.mjs your@email");
  process.exit(1);
}

const LEGACY_WARMUP = [
  "Light cardio, 2 to 3 min (jog in place, jumping jacks, skipping).",
  "Joint circles: ankles, knees, hips, shoulders, wrists.",
  "Dynamic stretches: leg swings, walking lunges with torso rotation, arm swings.",
  "Scapular activation: band pull-aparts or scap push-ups.",
  "Hip openers: 90/90 transitions, a deep squat hold.",
  "Finger and forearm prep: open-close the hands, wrist circles, light hangs.",
  "A set of push-ups to fire up the antagonists.",
];
const LEGACY_ANKLE = [
  "Calf raises, straight knee: 3 x 15 to 20.",
  "Calf raises, bent knee (soleus): 3 x 15 to 20.",
  "Eccentric heel drops off a step: 3 x 10 to 15, slow lower.",
  "Banded ankle, all four directions: 2 to 3 x 15 each.",
  "Tibialis raises (toes up against a wall): 3 x 20.",
  "Single-leg balance: 3 x 30 to 45 s, progress to eyes closed.",
  "Knee-to-wall ankle mobility: 3 x 10 per side.",
];
const LEGACY_MORNING_BLOCK = [
  "Morning light within 30 to 60 min of waking",
  "Ondra warm-up",
  "90-minute deep or personal block while energy is fresh",
  "Training session",
  "Park or reading if time allows",
];
const LEGACY_FIXED_ROCKS = ["German lesson - Tuesday", "German lesson - Friday"];
const LEGACY_MEALS = JSON.parse(
  readFileSync(new URL("../lib/diet/legacy-meals.json", import.meta.url), "utf8")
);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: user, error } = await admin
  .from("users")
  .select("id, email, coaching_prefs")
  .ilike("email", email)
  .maybeSingle();
if (error || !user) {
  console.error("User not found:", error?.message ?? email);
  process.exit(1);
}

const prefs = user.coaching_prefs ?? {};
const changes = [];

function fill(section, key, value, isEmptyOk = false) {
  const s = prefs[section] ?? {};
  const cur = s[key];
  const missing =
    cur == null || (Array.isArray(cur) && cur.length === 0 && !isEmptyOk);
  if (missing) {
    prefs[section] = { ...s, [key]: value };
    changes.push(`${section}.${key}`);
  }
}

fill("exercise", "warmup", LEGACY_WARMUP);
fill("exercise", "ankle", LEGACY_ANKLE);
fill("schedule", "morningBlock", LEGACY_MORNING_BLOCK);
fill("schedule", "fixedRocks", LEGACY_FIXED_ROCKS);
fill("diet", "meals", LEGACY_MEALS);

if (changes.length === 0) {
  console.log(`${user.email}: everything already saved in coaching_prefs. No changes.`);
  process.exit(0);
}

const { error: upError } = await admin
  .from("users")
  .update({ coaching_prefs: prefs })
  .eq("id", user.id);
if (upError) {
  console.error("Update failed:", upError.message);
  process.exit(1);
}
console.log(`${user.email}: preserved ${changes.join(", ")}.`);
