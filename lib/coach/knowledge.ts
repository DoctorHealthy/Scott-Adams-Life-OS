import { readFile } from "fs/promises";
import path from "path";

// The coach's brain. Loaded as system context before every call.
// The base (persona, doctrine, reframes, wisdom) is shared by every user.
// The profile section is PER USER: accounts created through onboarding carry
// their own brief in coaching_prefs.profile_brief; Mark's account predates the
// wizard and falls back to the static your-profile.md file.
const BASE_FILES = [
  "coach-persona.md",
  "adams-doctrine.md",
  "reframes-library.md",
  "daily-wisdom.md",
] as const;

let baseCache: string | null = null;
let markProfileCache: string | null = null;

export async function loadKnowledge(): Promise<string> {
  if (baseCache) return baseCache;
  const dir = path.join(process.cwd(), "coach-knowledge");
  const parts = await Promise.all(
    BASE_FILES.map(async (f) => {
      const text = await readFile(path.join(dir, f), "utf8");
      return `===== ${f} =====\n${text.trim()}`;
    })
  );
  baseCache = parts.join("\n\n");
  return baseCache;
}

export async function userProfileSection(
  coachingPrefs: Record<string, unknown> | null | undefined
): Promise<string> {
  const brief = coachingPrefs?.profile_brief;
  if (typeof brief === "string" && brief.trim()) {
    return `===== user-profile (from onboarding) =====\n${brief.trim()}`;
  }
  if (!markProfileCache) {
    const file = path.join(process.cwd(), "coach-knowledge", "your-profile.md");
    markProfileCache = (await readFile(file, "utf8")).trim();
  }
  return `===== your-profile.md =====\n${markProfileCache}`;
}
