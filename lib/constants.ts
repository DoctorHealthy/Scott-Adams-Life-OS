import type { MetricType, SystemStatus } from "./types";

// Adams' Big Five, ordered by the sleep-first campaign priority, plus Custom.
export const DOMAINS = [
  "Sleep",
  "Diet",
  "Exercise",
  "Flexible Schedule",
  "Imagination",
  "Custom",
] as const;

export const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: "binary", label: "Done / skipped" },
  { value: "number", label: "A number (reps, minutes, etc.)" },
  { value: "scale_1_10", label: "A 1 to 10 rating" },
];

export const STATUS_META: Record<
  SystemStatus,
  { label: string; hint: string }
> = {
  done: { label: "Done", hint: "Full version, the ceiling" },
  floor: { label: "Floor", hint: "Bad-day version, still counts" },
  skip: { label: "Skip", hint: "Did not run it today" },
};

// Local date as YYYY-MM-DD, using the browser's timezone. Deterministic.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Shift a YYYY-MM-DD string by n days in local time (DST-safe via midday anchor).
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

// Human label: "Wed, Jun 25". Built from fixed arrays, NOT toLocaleDateString,
// so the server (en-US) and a Vienna browser render identical text. That match
// is what keeps React hydration happy.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function prettyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS[weekday]}, ${MONTHS[m - 1]} ${d}`;
}
