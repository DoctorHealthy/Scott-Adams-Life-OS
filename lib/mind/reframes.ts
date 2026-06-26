// Reframe library, mirrored from coach-knowledge/reframes-library.md.
// `verified` = Adams' own; otherwise derived in his style and tuned to Mark.
// The coach surfaces one when the check-in shows negative self-talk; the user
// can also browse and pin favorites here.

export type Reframe = {
  id: string;
  category: string;
  old: string;
  next: string; // the new frame
  verified: boolean;
};

export const REFRAMES: Reframe[] = [
  // Verified Adams reframes
  { id: "v-time", category: "Adams core", old: "Manage your time", next: "Manage your energy.", verified: true },
  { id: "v-drink", category: "Adams core", old: "I need to drink less", next: "Alcohol is poison.", verified: true },
  { id: "v-cold", category: "Adams core", old: "I'm cold and uncomfortable", next: "Cold exposure is conducive to robust health.", verified: true },
  { id: "v-know", category: "Adams core", old: "Success depends on who you know", next: "Success depends on how many people you know.", verified: true },
  { id: "v-critics", category: "Adams core", old: "Your critics are evil monsters", next: "Your critics are your mascots.", verified: true },
  { id: "v-exercise", category: "Adams core", old: "I have to exercise", next: "Exercise is how I buy energy for everything else.", verified: true },
  { id: "v-goals", category: "Adams core", old: "Goals", next: "Systems.", verified: true },

  // Sleep / late nights
  { id: "d-night", category: "Sleep and late nights", old: "I'm a night person", next: "I trained myself nocturnal, and I can retrain myself.", verified: false },
  { id: "d-sleepwork", category: "Sleep and late nights", old: "I'll sleep when the work is done", next: "Sleep is the work. It builds tomorrow's output.", verified: false },
  { id: "d-boring", category: "Sleep and late nights", old: "Going to bed earlier is boring", next: "Mornings are the prize, and late nights are stealing them.", verified: false },

  // Motivation / laziness
  { id: "d-feel", category: "Motivation and laziness", old: "I don't feel like it", next: "Feelings are not in charge. The system is.", verified: false },
  { id: "d-motivated", category: "Motivation and laziness", old: "I'll start when I'm motivated", next: "Motion makes motivation, not the other way around.", verified: false },
  { id: "d-streak", category: "Motivation and laziness", old: "I missed a day, the streak's ruined", next: "Do the floor. The floor keeps the identity alive.", verified: false },

  // Diet
  { id: "d-hassle", category: "Diet", old: "Healthy food is a hassle", next: "I make the healthy choice the lazy choice.", verified: false },
  { id: "d-meal", category: "Diet", old: "This meal won't matter", next: "I'm running a lab. Every meal is a data point on my energy.", verified: false },

  // Work and pressure
  { id: "d-toomuch", category: "Work and pressure", old: "There's too much to do", next: "Energy first, then the work gets smaller.", verified: false },
  { id: "d-behind", category: "Work and pressure", old: "I'm behind", next: "I'm building the stack. Compounding looks slow up close.", verified: false },

  // Adversity (Stoic)
  { id: "d-inway", category: "Adversity", old: "This is in my way", next: "This is the way.", verified: false },
  { id: "d-whyme", category: "Adversity", old: "Why is this happening to me", next: "What does this make possible, and what here is in my control.", verified: false },
];

export const REFRAME_CATEGORIES: string[] = Array.from(
  new Set(REFRAMES.map((r) => r.category))
);

export function reframesByCategory(): { category: string; items: Reframe[] }[] {
  return REFRAME_CATEGORIES.map((category) => ({
    category,
    items: REFRAMES.filter((r) => r.category === category),
  }));
}
