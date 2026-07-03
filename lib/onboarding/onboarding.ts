// Onboarding: the intake shape, the AI proposal shape, and a solid fallback
// proposal so a Gemini hiccup never blocks a signup. The AI writes TEXT only
// (system rules, floors, goal titles, a profile brief). Code computes every
// number: calorie and macro targets, sleep config, session targets.

export type Intake = {
  name: string;
  age: number | null;
  sex: "male" | "female";
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: "sedentary" | "light" | "moderate" | "high" | "athlete";
  energyBaseline: number | null; // 1-10 typical day right now

  // Sleep
  currentWake: string; // "HH:MM"
  currentBed: string;
  goalWake: string;
  sleepHours: number;

  // Schedule
  workHours: string; // free text, e.g. "9 to 5 weekdays"
  fixedCommitments: string; // free text
  freeHours: string; // when they control their time

  // Diet
  dietConstraints: string[]; // e.g. lactose-free, vegetarian
  dietNotes: string; // free text preferences
  weightGoal: "lose" | "hold" | "gain";

  // Fitness
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  fitnessLikes: string; // free text: what they enjoy
  sessionsTarget: number; // real sessions per week
  injuries: string;

  // Mind + coaching
  vision: string;
  coachingStyle: "hardcore" | "firm" | "gentle";
  failureModes: string; // what usually breaks their habits
};

export const DEFAULT_INTAKE: Intake = {
  name: "",
  age: null,
  sex: "female",
  heightCm: null,
  weightKg: null,
  activityLevel: "moderate",
  energyBaseline: null,
  currentWake: "08:00",
  currentBed: "23:30",
  goalWake: "07:00",
  sleepHours: 8,
  workHours: "",
  fixedCommitments: "",
  freeHours: "",
  dietConstraints: [],
  dietNotes: "",
  weightGoal: "hold",
  fitnessLevel: "intermediate",
  fitnessLikes: "",
  sessionsTarget: 3,
  injuries: "",
  vision: "",
  coachingStyle: "firm",
  failureModes: "",
};

// What the AI proposes: text content per Big Five system plus seed goals and a
// profile brief the coach reads instead of Mark's static profile file.
export type ProposedSystem = {
  domain: "Sleep" | "Flexible Schedule" | "Imagination" | "Diet" | "Exercise";
  name: string;
  rule: string;
  floor: string;
  ceiling: string;
  anchor: string;
};

export type ProposedGoal = {
  title: string;
  why: string; // one-word cue
  quarter: 1 | 2 | 3 | 4;
  link: "manual" | "sleep_wake" | "training_sessions" | "diet_protein";
};

export type Proposal = {
  systems: ProposedSystem[];
  goals: ProposedGoal[];
  profileBrief: string; // markdown the coach loads as this user's profile
};

export const SYSTEM_ORDER: ProposedSystem["domain"][] = [
  "Sleep",
  "Flexible Schedule",
  "Imagination",
  "Diet",
  "Exercise",
];

// A sane, generic proposal used when the AI is unavailable or returns junk.
// The user edits everything on the review screen anyway.
export function fallbackProposal(intake: Intake): Proposal {
  const q = (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return {
    systems: [
      {
        domain: "Sleep",
        name: "Sleep",
        rule: `Wake at ${intake.currentWake} every day, shift toward ${intake.goalWake} in 30-minute steps. Morning light soon after waking, wind down before bed.`,
        floor: "Wake within 60 minutes of target, get daylight within the first hour.",
        ceiling: "On-target wake, morning light, screens off 60 minutes before bed.",
        anchor: "The alarm. Feet on the floor, no snooze.",
      },
      {
        domain: "Flexible Schedule",
        name: "Morning & schedule",
        rule: "Protect one block of controlled time each day for what matters most.",
        floor: "Ten minutes on the most important personal task.",
        ceiling: "A full deep block plus the day planned the night before.",
        anchor: "Right after the morning routine.",
      },
      {
        domain: "Imagination",
        name: "Mind",
        rule: "One-line morning intention. Short evening reflection. Reframe negative self-talk when it shows up.",
        floor: "One sentence in the evening reflection.",
        ceiling: "Intention, reflection, and one reframe used during the day.",
        anchor: "First coffee or first screen of the day.",
      },
      {
        domain: "Diet",
        name: "Diet",
        rule: "Protein first, real food, hit the computed calorie and protein targets most days.",
        floor: "Log the day and get protein in two meals.",
        ceiling: "Targets hit with whole food inside the eating window.",
        anchor: "Each meal.",
      },
      {
        domain: "Exercise",
        name: "Exercise",
        rule: `${intake.sessionsTarget} real sessions a week, scaled to your level.`,
        floor: "A 10-minute walk or a short mobility circuit. It still counts.",
        ceiling: "The full planned session.",
        anchor: "A fixed slot in your free hours.",
      },
    ],
    goals: [
      {
        title: `Wake at ${intake.goalWake} consistently`,
        why: "mornings",
        quarter: q,
        link: "sleep_wake",
      },
      {
        title: `${intake.sessionsTarget} sessions a week, every week`,
        why: "strength",
        quarter: q,
        link: "training_sessions",
      },
    ],
    profileBrief: buildProfileBriefFallback(intake),
  };
}

export function buildProfileBriefFallback(intake: Intake): string {
  const c = intake.dietConstraints.length
    ? intake.dietConstraints.join(", ")
    : "none listed";
  return [
    `# User profile: ${intake.name || "New user"}`,
    "",
    `- Age ${intake.age ?? "?"}, height ${intake.heightCm ?? "?"} cm, weight ${intake.weightKg ?? "?"} kg, activity ${intake.activityLevel}.`,
    `- Sleep now: wakes about ${intake.currentWake}, bed about ${intake.currentBed}. Goal wake ${intake.goalWake}, wants ${intake.sleepHours}h.`,
    `- Work hours: ${intake.workHours || "not given"}. Fixed commitments: ${intake.fixedCommitments || "none listed"}. Controls: ${intake.freeHours || "not given"}.`,
    `- Diet constraints: ${c}. Notes: ${intake.dietNotes || "none"}. Weight goal: ${intake.weightGoal}.`,
    `- Fitness: ${intake.fitnessLevel}. Likes: ${intake.fitnessLikes || "not given"}. Injuries: ${intake.injuries || "none listed"}. Target ${intake.sessionsTarget} sessions/week.`,
    `- Vision: ${intake.vision || "not given"}.`,
    `- Coaching style: ${intake.coachingStyle}. Typical energy now: ${intake.energyBaseline ?? "?"}/10.`,
    `- Failure modes to design against: ${intake.failureModes || "not given"}.`,
  ].join("\n");
}
