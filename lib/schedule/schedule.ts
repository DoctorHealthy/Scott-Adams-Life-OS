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
  "Ondra warm-up",
  "90-minute deep or personal block while energy is fresh",
  "Training session",
  "Park or reading if time allows",
];

export const DEFAULT_FIXED_ROCKS: string[] = [
  "German lesson - Tuesday",
  "German lesson - Friday",
];

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
    fixedRocks:
      Array.isArray(s.fixedRocks) && s.fixedRocks.length > 0
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
