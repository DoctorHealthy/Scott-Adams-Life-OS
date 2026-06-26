// Mind setup (pinned vision + pinned reframes), stored under
// coaching_prefs.mind. The per-day morning intention lives in module_logs.mind.

export type MindConfig = {
  vision: string;
  pinnedReframes: string[]; // reframe ids
};

export const DEFAULT_VISION =
  "Leader with my own team. Multi-entrepreneur with several income streams. Athletic, free, strong, focused, locked in.";

export const DEFAULT_MIND_CONFIG: MindConfig = {
  vision: DEFAULT_VISION,
  pinnedReframes: [],
};

export function readMindConfig(
  coachingPrefs: Record<string, unknown> | null | undefined
): MindConfig {
  const m = (coachingPrefs?.mind ?? {}) as Partial<MindConfig>;
  return {
    vision: typeof m.vision === "string" && m.vision.trim() ? m.vision : DEFAULT_VISION,
    pinnedReframes: Array.isArray(m.pinnedReframes) ? m.pinnedReframes : [],
  };
}

export type MindLog = { intention: string | null };

export function emptyMindLog(): MindLog {
  return { intention: null };
}

export function readMindLog(raw: unknown): MindLog {
  if (raw && typeof raw === "object") {
    const o = raw as Partial<MindLog>;
    return { intention: typeof o.intention === "string" ? o.intention : null };
  }
  return emptyMindLog();
}
