// Concrete, generic examples for each domain. Used only as input placeholders in
// the systems form, to show the shape of a good rule / min / ceiling / anchor.
// These are hints, never saved values.

export type DomainExample = {
  rule: string;
  floor: string;
  ceiling: string;
  anchor: string;
};

export const DOMAIN_EXAMPLES: Record<string, DomainExample> = {
  Sleep: {
    rule: "Out of bed at the target wake time, no snooze",
    floor: "Up within 30 min of target",
    ceiling: "Up on time plus sunlight in the first 30 min",
    anchor: "When the alarm goes off",
  },
  Diet: {
    rule: "No sugar or processed carbs before dinner",
    floor: "One clean meal today",
    ceiling: "Whole-food meals all day, no snacking",
    anchor: "At each meal",
  },
  Exercise: {
    rule: "Move the body every day",
    floor: "A ten-minute walk",
    ceiling: "A full workout plus a walk",
    anchor: "After the morning coffee",
  },
  "Flexible Schedule": {
    rule: "Protect one deep-work block a day",
    floor: "Twenty-five focused minutes",
    ceiling: "Two hours, no meetings, phone away",
    anchor: "First thing after opening the laptop",
  },
  Imagination: {
    rule: "Feed the mind something new daily",
    floor: "Read one page",
    ceiling: "Read for 30 min and write a few notes",
    anchor: "Before bed",
  },
  Custom: {
    rule: "Three meaningful networking touches a week",
    floor: "One message to one person",
    ceiling: "A call or meetup booked",
    anchor: "After lunch on weekdays",
  },
};

// Full, ready-to-save starting points for the create form. Unlike DOMAIN_EXAMPLES
// (placeholders only), choosing a template fills the whole form with real values
// the user can then edit before saving.
export type SystemTemplate = {
  key: string;
  label: string;
  values: {
    name: string;
    domain: string;
    cadence: "daily" | "weekly";
    target_per_week: number | null;
    metric_type: "binary" | "number";
    unit: string | null;
    rule: string;
    floor: string;
    ceiling: string;
    anchor: string;
  };
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    key: "networking",
    label: "Networking",
    values: {
      name: "Networking",
      domain: "Custom",
      cadence: "weekly",
      target_per_week: 3,
      metric_type: "number",
      unit: "touches",
      rule: "Three meaningful networking touches a week (message, call, intro)",
      floor: "One genuine message to one person",
      ceiling: "A call or meetup booked",
      anchor: "After lunch on weekdays",
    },
  },
  {
    key: "reading",
    label: "Reading",
    values: {
      name: "Reading",
      domain: "Imagination",
      cadence: "daily",
      target_per_week: null,
      metric_type: "binary",
      unit: null,
      rule: "Read 20 minutes",
      floor: "One page",
      ceiling: "A chapter plus notes",
      anchor: "In bed before lights off",
    },
  },
  {
    key: "language-practice",
    label: "Language practice",
    values: {
      name: "Language practice",
      domain: "Custom",
      cadence: "weekly",
      target_per_week: 5,
      metric_type: "number",
      unit: "sessions",
      rule: "Five short practice sessions a week",
      floor: "One 5-minute app session",
      ceiling: "A full lesson or a conversation",
      anchor: "With morning coffee",
    },
  },
  {
    key: "skill-practice",
    label: "Skill practice",
    values: {
      name: "Skill practice",
      domain: "Custom",
      cadence: "weekly",
      target_per_week: 3,
      metric_type: "number",
      unit: "sessions",
      rule: "Three deliberate practice blocks a week on the skill",
      floor: "15 focused minutes",
      ceiling: "A 90-minute deep block with notes",
      anchor: "First free evening slot",
    },
  },
];
