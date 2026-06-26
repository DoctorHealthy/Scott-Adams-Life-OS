// Daily gem pool, mirrored from coach-knowledge/daily-wisdom.md.
// Attribution kept honest: `note` flags anything that is not a plain sourced
// quote (a faithful short form, or a paraphrase). The gem of the day is chosen
// in code by date so it is deterministic and does not repeat for ~3 weeks.

export type Gem = {
  text: string;
  source: string;
  note?: string; // e.g. "faithful short form", "paraphrase, not verbatim"
};

export const GEMS: Gem[] = [
  // Marcus Aurelius, Meditations
  {
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    source: "Marcus Aurelius, Meditations 5.20",
  },
  {
    text: "Waste no more time arguing about what a good man should be. Be one.",
    source: "Marcus Aurelius, Meditations 10.16",
  },
  {
    text: "You could leave life right now. Let that determine what you do and say and think.",
    source: "Marcus Aurelius, Meditations 2.11",
  },
  {
    text: "If it is not right, do not do it; if it is not true, do not say it.",
    source: "Marcus Aurelius, Meditations 12.17",
  },
  {
    text: "When you wake, tell yourself you'll meet interference, ingratitude, and people who get in the way. None of it can touch what's yours to control. Begin anyway.",
    source: "Marcus Aurelius, Meditations 2.1",
    note: "faithful short form",
  },
  {
    text: "Confine yourself to the present.",
    source: "Marcus Aurelius, Meditations",
  },
  // Seneca
  {
    text: "We suffer more often in imagination than in reality.",
    source: "Seneca, Letters",
  },
  {
    text: "It is not that we have a short time to live, but that we waste much of it.",
    source: "Seneca, On the Shortness of Life",
  },
  {
    text: "Difficulties strengthen the mind, as labor does the body.",
    source: "Seneca",
  },
  {
    text: "Begin at once to live, and count each separate day as a separate life.",
    source: "Seneca, Letters",
  },
  // Epictetus
  {
    text: "It's not what happens to you, but how you react that matters.",
    source: "Epictetus",
  },
  {
    text: "No man is free who is not master of himself.",
    source: "Epictetus",
  },
  {
    text: "First say to yourself what you would be, then do what you have to do.",
    source: "Epictetus, Discourses",
  },
  // Scott Adams
  {
    text: "Goals are for losers. Systems are for winners.",
    source: "Scott Adams",
  },
  {
    text: "Maximize your personal energy, not the number of tasks.",
    source: "Scott Adams",
  },
  {
    text: "A reframe doesn't have to be true. It has to be useful.",
    source: "Scott Adams",
  },
  // In the spirit of Hormozi (paraphrased standards, not verbatim)
  {
    text: "The work works. Your only job is to keep showing up to it.",
    source: "In the spirit of Alex Hormozi",
    note: "paraphrase, not verbatim",
  },
  {
    text: "You're not behind. You're early in a long game.",
    source: "In the spirit of Alex Hormozi",
    note: "paraphrase, not verbatim",
  },
  {
    text: "Nobody is coming to save you. That's good news. It means it's yours.",
    source: "In the spirit of Alex Hormozi",
    note: "paraphrase, not verbatim",
  },
];

// Whole days since the Unix epoch for a YYYY-MM-DD, computed from the date parts
// (no timezone drift). Deterministic.
function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function gemForDate(dateStr: string): Gem {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return GEMS[0];
  const idx = ((dayNumber(dateStr) % GEMS.length) + GEMS.length) % GEMS.length;
  return GEMS[idx];
}
