// Review preferences, stored under coaching_prefs.review. Currently just the
// weekly review day (0 = Sunday ... 6 = Saturday), default Sunday.

export type ReviewConfig = {
  weeklyDay: number; // 0-6, 0 = Sunday
};

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = { weeklyDay: 0 };

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function readReviewConfig(
  coachingPrefs: Record<string, unknown> | null | undefined
): ReviewConfig {
  const r = (coachingPrefs?.review ?? {}) as Partial<ReviewConfig>;
  const day =
    typeof r.weeklyDay === "number" && r.weeklyDay >= 0 && r.weeklyDay <= 6
      ? Math.floor(r.weeklyDay)
      : DEFAULT_REVIEW_CONFIG.weeklyDay;
  return { weeklyDay: day };
}

// Weekday of a YYYY-MM-DD in local time, 0 = Sunday.
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
