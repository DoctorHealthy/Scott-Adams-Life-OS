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
