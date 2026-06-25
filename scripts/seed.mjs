// One-time seed of Mark's profile + Big Five systems.
// Run with: node --env-file=.env.local scripts/seed.mjs [optional-email]
// Idempotent: updates the profile and inserts only systems whose name is missing.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the Supabase secret key.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const targetEmail = process.argv[2] || null;

// ---- Mark's profile, from coach-knowledge/your-profile.md ----
const PROFILE = {
  name: "Mark",
  age: 22,
  height_cm: 188,
  weight_kg: 88,
  activity_level: "high", // trains most days; mapped to a multiplier in the calorie module
  constraints: {
    lactose_free: true,
    low_added_sugar: true,
    diabetes_risk: true,
    left_ankle: true,
    right_ankle_minor: true,
    trains_at_home_or_outdoors: true,
    ex_powerlifter: true,
    no_caffeine: true,
  },
  coaching_prefs: {
    directiveness: "hardcore",
    learning: "reasoning once, then orders",
    check_in_minutes: 5,
    weekly_review: true,
    no_emojis: true,
    no_em_dashes: true,
    timezone: "Europe/Vienna",
    work_hours: "15:00-22:00 Europe/Vienna (US East Coast overlap)",
    goal: "hold about 88 kg, gain muscle and strength",
  },
};

// Canonical display order: Sleep, Schedule/Morning, Mind, Diet, Exercise.
// sort_order is set from this, independent of the array order below.
const ORDER = [
  "Wake at target time",
  "Wind-down read",
  "Protect the morning block",
  "Intention and reflection",
  "Protein-first, tight window",
  "Ondra morning warm-up",
  "Training session",
  "Left-ankle prehab",
];

// ---- The Big Five seed ----
const SYSTEMS = [
  {
    name: "Wake at target time",
    domain: "Sleep",
    rule: "Out of bed at the target wake time, no snooze. Wake-time consistency leads the whole shift.",
    floor: "Up within 30 minutes of target.",
    ceiling: "Up on target, straight into daylight.",
    metric_type: "binary",
    anchor: "Alarm",
    schedule_block: "Morning, on waking",
  },
  {
    name: "Wind-down read",
    domain: "Sleep",
    rule: "Screens off, read until sleepy. Reading winds you down where brushing teeth does nothing.",
    floor: "Five minutes of reading in bed.",
    ceiling: "20 to 30 minutes reading, lights low, asleep near target.",
    metric_type: "binary",
    anchor: "Getting into bed",
    schedule_block: "Night, before bed",
  },
  {
    name: "Protein-first, tight window",
    domain: "Diet",
    rule: "Two to three real meals, protein first, front-loaded earlier, last meal well before bed. No fasting.",
    floor: "Hit the protein target, even if the window slips.",
    ceiling: "Protein hit, window tight, last meal early, steady energy after eating.",
    metric_type: "binary",
    anchor: "Meals",
    schedule_block: "Daytime, earlier-weighted",
  },
  {
    name: "Ondra morning warm-up",
    domain: "Exercise",
    rule: "Adam Ondra mobility warm-up to wake the body.",
    floor: "Three minutes of the warm-up.",
    ceiling: "Full warm-up, unrushed.",
    metric_type: "binary",
    anchor: "After waking",
    schedule_block: "Morning, on waking",
  },
  {
    name: "Training session",
    domain: "Exercise",
    rule: "Strength-endurance or power session, home or outdoors. Scaled for an ex-powerlifter, not beginner work.",
    floor: "One hard set or a short circuit.",
    ceiling: "Full session, high quality.",
    metric_type: "binary",
    anchor: "After the morning block",
    schedule_block: "Late morning or midday",
  },
  {
    name: "Left-ankle prehab",
    domain: "Exercise",
    rule: "Ankle strengthening and prehab so bouldering gets easier and safer.",
    floor: "One prehab set.",
    ceiling: "Full prehab block, both ankles.",
    metric_type: "binary",
    anchor: "With training or warm-up",
    schedule_block: "Morning or pre-session",
  },
  {
    name: "Protect the morning block",
    domain: "Flexible Schedule",
    rule: "Guard a 90-minute deep-work or personal block before work owns 3pm to 10pm.",
    floor: "Protect 30 minutes.",
    ceiling: "Full 90 minutes, single-tasked, before work starts.",
    metric_type: "binary",
    anchor: "After the warm-up",
    schedule_block: "Morning, before 3pm",
  },
  {
    name: "Intention and reflection",
    domain: "Imagination",
    rule: "One-line morning intention and an evening reflection. Picture the future self: athletic, free, locked in.",
    floor: "One line at night.",
    ceiling: "Morning intention plus a real evening reflection.",
    metric_type: "binary",
    anchor: "Morning start and evening wind-down",
    schedule_block: "Morning and night",
  },
];

async function main() {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error("Could not list users:", listErr.message);
    process.exit(1);
  }
  const users = list?.users ?? [];
  if (users.length === 0) {
    console.error("No users found. Create your account in the app first.");
    process.exit(1);
  }

  let user;
  if (targetEmail) {
    user = users.find(
      (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase()
    );
  } else if (users.length === 1) {
    user = users[0];
  }
  if (!user) {
    console.error(
      `Pick a user by email. Found: ${users.map((u) => u.email).join(", ")}`
    );
    process.exit(1);
  }
  console.log(`Seeding user: ${user.email} (${user.id})`);

  const { error: pErr } = await admin
    .from("users")
    .update(PROFILE)
    .eq("id", user.id);
  if (pErr) {
    console.error("Profile update failed:", pErr.message);
    process.exit(1);
  }
  console.log("Profile updated.");

  const { data: existing, error: exErr } = await admin
    .from("systems")
    .select("name")
    .eq("user_id", user.id);
  if (exErr) {
    console.error("Could not read existing systems:", exErr.message);
    process.exit(1);
  }
  const have = new Set((existing ?? []).map((s) => s.name));
  const orderOf = (name) => {
    const i = ORDER.indexOf(name);
    return i === -1 ? ORDER.length : i;
  };
  const rows = SYSTEMS.filter((s) => !have.has(s.name)).map((s) => ({
    ...s,
    user_id: user.id,
    active: true,
    sort_order: orderOf(s.name),
  }));

  if (rows.length === 0) {
    console.log("All Big Five systems already present. Nothing inserted.");
  } else {
    const { error: sErr } = await admin.from("systems").insert(rows);
    if (sErr) {
      console.error("Systems insert failed:", sErr.message);
      process.exit(1);
    }
    console.log(`Inserted ${rows.length} systems.`);
  }

  // Reconcile sort_order on the canonical Big Five so the order is correct
  // even on accounts seeded before this order was set.
  for (let i = 0; i < ORDER.length; i++) {
    const { error: oErr } = await admin
      .from("systems")
      .update({ sort_order: i })
      .eq("user_id", user.id)
      .eq("name", ORDER[i]);
    if (oErr) {
      console.error(`Could not set order for "${ORDER[i]}":`, oErr.message);
      process.exit(1);
    }
  }
  console.log("Order reconciled (Sleep, Schedule/Morning, Mind, Diet, Exercise).");
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
