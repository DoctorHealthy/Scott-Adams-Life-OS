// Morning & schedule setup, stored under coaching_prefs.schedule.
// The Eisenhower matrix is personal only: life and venture ideas, no work tasks.
// Quadrant sorting and counts are computed here in code.

export type Quadrant = 1 | 2 | 3 | 4;

export type EisenhowerItem = {
  id: string;
  text: string;
  quadrant: Quadrant;
};

export type ScheduleConfig = {
  morningBlock: string[];
  slotWhenFree: string[];
  fixedRocks: string[];
  eisenhower: EisenhowerItem[];
};

export const QUADRANTS: {
  q: Quadrant;
  title: string;
  sub: string;
  action: string;
  tone: "do" | "protect" | "flag";
}[] = [
  { q: 1, title: "Q1", sub: "Important + Urgent", action: "Do now", tone: "do" },
  { q: 2, title: "Q2", sub: "Important + Not urgent", action: "Protect this, it is where growth lives", tone: "protect" },
  { q: 3, title: "Q3", sub: "Not important + Urgent", action: "Delegate or batch", tone: "flag" },
  { q: 4, title: "Q4", sub: "Not important + Not urgent", action: "Cut", tone: "flag" },
];

export const DEFAULT_MORNING_BLOCK: string[] = [
  "Morning light within 30 to 60 min of waking",
  "Warm-up",
  "90-minute deep or personal block while energy is fresh",
  "Training session if planned",
];

export const DEFAULT_FIXED_ROCKS: string[] = [];

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  morningBlock: DEFAULT_MORNING_BLOCK,
  slotWhenFree: [],
  fixedRocks: DEFAULT_FIXED_ROCKS,
  eisenhower: [],
};

export function readScheduleConfig(
  coachingPrefs: Record<string, unknown> | null | undefined
): ScheduleConfig {
  const s = (coachingPrefs?.schedule ?? {}) as Partial<ScheduleConfig>;
  return {
    morningBlock:
      Array.isArray(s.morningBlock) && s.morningBlock.length > 0
        ? (s.morningBlock as string[])
        : DEFAULT_MORNING_BLOCK,
    slotWhenFree: Array.isArray(s.slotWhenFree) ? (s.slotWhenFree as string[]) : [],
    // A stored array wins even when empty (the user cleared it); only a missing
    // key falls back to the default.
    fixedRocks: Array.isArray(s.fixedRocks)
      ? (s.fixedRocks as string[])
      : DEFAULT_FIXED_ROCKS,
    eisenhower: Array.isArray(s.eisenhower)
      ? (s.eisenhower as EisenhowerItem[]).filter(
          (i) => i && typeof i.id === "string" && typeof i.text === "string"
        )
      : [],
  };
}

export function itemsInQuadrant(
  items: EisenhowerItem[],
  q: Quadrant
): EisenhowerItem[] {
  return items.filter((i) => i.quadrant === q);
}

export function quadrantCounts(
  items: EisenhowerItem[]
): Record<Quadrant, number> {
  return {
    1: itemsInQuadrant(items, 1).length,
    2: itemsInQuadrant(items, 2).length,
    3: itemsInQuadrant(items, 3).length,
    4: itemsInQuadrant(items, 4).length,
  };
}

// Full and short weekday names, indexed to match Date.getDay() (Sunday = 0).
const WEEKDAY_NAMES: [full: string, short: string][] = [
  ["Sunday", "Sun"],
  ["Monday", "Mon"],
  ["Tuesday", "Tue"],
  ["Wednesday", "Wed"],
  ["Thursday", "Thu"],
  ["Friday", "Fri"],
  ["Saturday", "Sat"],
];

// Fixed rocks whose text names the given weekday (0 = Sunday .. 6 = Saturday),
// matched case-insensitively against the full name or the short form as whole
// words. Used to surface today's fixed commitments to the coach.
export function rocksForWeekday(rocks: string[], weekday: number): string[] {
  const names = WEEKDAY_NAMES[weekday];
  if (!names) return [];
  const re = new RegExp(`\\b(${names[0]}|${names[1]})\\b`, "i");
  return rocks.filter((r) => re.test(r));
}
