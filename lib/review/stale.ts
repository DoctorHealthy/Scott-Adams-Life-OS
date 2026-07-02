// Goal staleness, computed in code from the stored review snapshots. A goal is
// "stale" when its progress has not moved across reviews for a while. The coach
// flags it; it never computes the staleness itself.

export type SnapshotReview = {
  period_end: string; // YYYY-MM-DD
  goalSnapshot: { id: string; progress: number }[];
};

export const STALE_AFTER_DAYS = 14;

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000
  );
}

// For each goal: days since its progress last changed, judged against the
// review history. null = not enough history to judge (fewer than two
// snapshots containing the goal).
export function goalStaleDays(
  goals: { id: string; progress: number }[],
  reviews: SnapshotReview[],
  today: string
): Map<string, number | null> {
  const sorted = [...reviews].sort((a, b) => (a.period_end < b.period_end ? 1 : -1)); // newest first
  const out = new Map<string, number | null>();

  for (const g of goals) {
    let lastSeen: { date: string; progress: number } | null = null;
    let changedOn: string | null = null;
    let snapshots = 0;

    for (const r of sorted) {
      const snap = r.goalSnapshot?.find((x) => x.id === g.id);
      if (!snap) continue;
      snapshots++;
      if (snap.progress !== g.progress) {
        // The most recent snapshot that differs from today's progress: the
        // goal moved somewhere after this review.
        changedOn = r.period_end;
        break;
      }
      lastSeen = { date: r.period_end, progress: snap.progress };
    }

    if (changedOn) {
      out.set(g.id, daysBetween(changedOn, today));
    } else if (snapshots >= 2 && lastSeen) {
      // Unchanged across every snapshot we have: stale since the oldest one.
      out.set(g.id, daysBetween(lastSeen.date, today));
    } else {
      out.set(g.id, null);
    }
  }
  return out;
}
