// Seed + consolidate Mark's profile and the Big Five systems.
// Run with: node --env-file=.env.local scripts/seed.mjs [optional-email]
//
// Idempotent. Consolidates the earlier 8-system seed into the Big Five:
// Sleep, Schedule/Morning, Mind, Diet, Exercise. Old single-purpose systems are
// renamed in place (so their check-in history is preserved); folded sub-routines
// (wind-down, Ondra warm-up, ankle prehab) are removed as top-level systems and
// now live inside the Sleep and Exercise playbooks.

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
  activity_level: "high",
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

// ---- The Big Five, in display order: Sleep, Schedule/Morning, Mind, Diet, Exercise ----
const CANON = [
  {
    name: "Sleep",
    domain: "Sleep",
    rule: "Wake at the target time every day, no snooze. Wind down on a book, not a screen. Wake time leads, bedtime falls in behind it.",
    floor: "Up within 30 minutes of target. One chapter before lights out.",
    ceiling: "Up on target and into daylight. Asleep near target after a real wind-down.",
    metric_type: "binary",
    anchor: "The alarm and the edge of the bed",
    schedule_block: "First thing and last thing",
  },
  {
    name: "Morning & schedule",
    domain: "Flexible Schedule",
    rule: "Own the morning before work owns the afternoon. Light, warm-up, then a 90-minute block on what matters, all before 3pm.",
    floor: "Protect 30 focused minutes before work.",
    ceiling: "Sunlight within 30 minutes of waking, warm-up done, a full 90-minute block, single-tasked.",
    metric_type: "binary",
    anchor: "Straight after you wake",
    schedule_block: "Morning, before 3pm",
  },
  {
    name: "Mind",
    domain: "Imagination",
    rule: "One-line intention in the morning, an honest reflection at night. Catch the junk thoughts and reframe them. Hold the picture: athletic, free, locked in.",
    floor: "One honest line at night.",
    ceiling: "Morning intention set, evening reflection done, one reframe banked.",
    metric_type: "binary",
    anchor: "The start and the end of the day",
    schedule_block: "Morning and night",
  },
  {
    name: "Diet",
    domain: "Diet",
    rule: "Hit your numbers without thinking about it. Protein first, whole-food carbs, lactose-free, low sugar. Tight window, last meal well before bed.",
    floor: "Hit protein. Cut the junk.",
    ceiling: "Calories and protein on target, window tight, dinner early, energy steady after eating.",
    metric_type: "binary",
    anchor: "Meals",
    schedule_block: "Daytime, front-loaded",
  },
  {
    name: "Exercise",
    domain: "Exercise",
    rule: "Train like the ex-powerlifter you are. Ondra mobility to open the body, a real strength-endurance or power session, ankle prehab so bouldering stops costing you.",
    floor: "Warm-up plus one hard set.",
    ceiling: "Full warm-up, full session, ankle prehab done. Home or outdoors, no gym required.",
    metric_type: "binary",
    anchor: "After the morning block",
    schedule_block: "Late morning or midday",
  },
];

// Old single-purpose seed name -> canonical name (rename in place, keep history).
const RENAME = {
  "Wake at target time": "Sleep",
  "Protect the morning block": "Morning & schedule",
  "Intention and reflection": "Mind",
  "Protein-first, tight window": "Diet",
  "Training session": "Exercise",
};

// Sub-routines now folded into the Sleep / Exercise playbooks.
const FOLD_DELETE = [
  "Wind-down read",
  "Ondra morning warm-up",
  "Left-ankle prehab",
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

  // 1) Rename old systems to canonical names (preserves id + history).
  const { data: before } = await admin
    .from("systems")
    .select("id, name")
    .eq("user_id", user.id);
  const existingNames = new Set((before ?? []).map((r) => r.name));

  for (const [from, to] of Object.entries(RENAME)) {
    if (existingNames.has(from) && !existingNames.has(to)) {
      const { error } = await admin
        .from("systems")
        .update({ name: to })
        .eq("user_id", user.id)
        .eq("name", from);
      if (error) {
        console.error(`Rename "${from}" -> "${to}" failed:`, error.message);
        process.exit(1);
      }
      existingNames.delete(from);
      existingNames.add(to);
      console.log(`Renamed "${from}" -> "${to}".`);
    }
  }

  // 2) Delete folded sub-routines.
  for (const name of FOLD_DELETE) {
    const { error } = await admin
      .from("systems")
      .delete()
      .eq("user_id", user.id)
      .eq("name", name);
    if (error) {
      console.error(`Delete "${name}" failed:`, error.message);
      process.exit(1);
    }
  }

  // 3) Reconcile the Big Five: update fields + order if present, insert if not.
  const { data: now } = await admin
    .from("systems")
    .select("id, name")
    .eq("user_id", user.id);
  const byName = new Map((now ?? []).map((r) => [r.name, r.id]));

  for (let i = 0; i < CANON.length; i++) {
    const c = CANON[i];
    const fields = { ...c, active: true, sort_order: i, user_id: user.id };
    if (byName.has(c.name)) {
      const { error } = await admin
        .from("systems")
        .update(fields)
        .eq("id", byName.get(c.name));
      if (error) {
        console.error(`Update "${c.name}" failed:`, error.message);
        process.exit(1);
      }
    } else {
      const { error } = await admin.from("systems").insert(fields);
      if (error) {
        console.error(`Insert "${c.name}" failed:`, error.message);
        process.exit(1);
      }
    }
  }

  console.log("Consolidated to the Big Five: Sleep, Schedule/Morning, Mind, Diet, Exercise.");
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
