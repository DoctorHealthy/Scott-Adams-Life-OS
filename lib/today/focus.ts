// The one-line dynamic focus for the top card. Derived in code from the same
// signals that drive the briefing, so it changes with the data and never
// recites static targets. Returns null when nothing is genuinely off track;
// the card then shows just the gem (per Today-Design-Spec v2.1).

import type { BriefingSignals } from "./briefing";

export function deriveFocusLine(s: BriefingSignals): string | null {
  // Priority order: the sleep campaign first (the keystone), then training
  // volume, then protein. One line, one focus, never a list.
  if (s.sleep.eligible) {
    return "Sleep step held. Advance the wake target in the Sleep playbook.";
  }
  if (s.sleep.driftMin != null && s.sleep.driftMin > 30) {
    return `Wake drifted ${s.sleep.driftMin} min late. Hold ${s.sleep.currentWake} today, no negotiation.`;
  }
  if (s.training.behind) {
    return `Training ${s.training.sessionsLast7} of ${s.training.sessionsTarget} this week. ${s.training.sessionDue} today.`;
  }
  if (s.diet.proteinUnder && s.diet.proteinTarget != null) {
    return `Protein running under. Hit ${s.diet.proteinTarget} g today.`;
  }
  return null;
}
