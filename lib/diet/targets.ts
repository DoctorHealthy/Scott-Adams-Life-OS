// Calorie + macro targets. Pure code, deterministic. Mifflin-St Jeor.
// The coach READS these numbers. It never computes them.

type ProfileLike = {
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  // Sex lives in coaching_prefs.intake.sex (set by onboarding). Profiles that
  // predate the wizard have none and default to male (Mark's account).
  coaching_prefs?: Record<string, unknown> | null;
};

const ACTIVITY: Record<string, { mult: number; label: string }> = {
  sedentary: { mult: 1.2, label: "Sedentary" },
  light: { mult: 1.375, label: "Light, 1 to 3 days a week" },
  moderate: { mult: 1.55, label: "Moderate, 3 to 5 days a week" },
  high: { mult: 1.6, label: "High, trains most days" },
  athlete: { mult: 1.725, label: "Athlete, hard training daily" },
};

export type Targets = {
  ok: boolean; // true when calorie targets are computable (age, height, weight set)
  bmr: number | null;
  maintenance: number | null;
  leanGain: number | null; // the default goal: gain muscle, not lose weight
  protein: number | null;
  waterMl: number | null; // depends only on weight
  activityLabel: string;
  missing: string[];
};

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function computeTargets(p: ProfileLike | null): Targets {
  const act = ACTIVITY[p?.activity_level ?? "moderate"] ?? ACTIVITY.moderate;
  const missing: string[] = [];
  if (!p) missing.push("profile");
  if (p && p.age == null) missing.push("age");
  if (p && p.height_cm == null) missing.push("height");
  if (p && p.weight_kg == null) missing.push("weight");

  // Water depends only on bodyweight, so compute it whenever weight is known.
  const waterMl =
    p && p.weight_kg != null ? roundTo((p.weight_kg as number) * 35, 250) : null;

  if (missing.length || !p) {
    return {
      ok: false,
      bmr: null,
      maintenance: null,
      leanGain: null,
      protein: null,
      waterMl,
      activityLabel: act.label,
      missing,
    };
  }

  const kg = p.weight_kg as number;
  const cm = p.height_cm as number;
  const age = p.age as number;

  // Mifflin-St Jeor, sex-adjusted (+5 male, -161 female).
  const intake = (p.coaching_prefs?.intake ?? {}) as { sex?: unknown };
  const female = intake.sex === "female";
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (female ? -161 : 5);
  const maintenance = roundTo(bmr * act.mult, 50);
  const leanGain = roundTo(maintenance + 250, 50);
  const protein = roundTo(kg * 1.9, 10);

  return {
    ok: true,
    bmr: Math.round(bmr),
    maintenance,
    leanGain,
    protein,
    waterMl,
    activityLabel: act.label,
    missing: [],
  };
}
