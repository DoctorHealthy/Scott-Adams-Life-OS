// Which trend charts the user wants, in order. Stored under
// coaching_prefs.trends.metrics as an ordered list of metric keys.

export const DEFAULT_TREND_METRICS = [
  "energy",
  "wake",
  "adherence",
  "protein",
  "weight",
];

export function readTrendMetrics(
  coachingPrefs: Record<string, unknown> | null | undefined
): string[] {
  const t = (coachingPrefs?.trends ?? {}) as { metrics?: unknown };
  if (Array.isArray(t.metrics)) {
    const keys = t.metrics.filter((k): k is string => typeof k === "string");
    return keys; // may be empty if the user cleared them on purpose
  }
  return DEFAULT_TREND_METRICS;
}
