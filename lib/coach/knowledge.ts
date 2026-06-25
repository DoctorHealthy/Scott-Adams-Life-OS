import { readFile } from "fs/promises";
import path from "path";

// The coach's brain. Loaded as system context before every call.
// Order matters: persona first (voice + guardrails), then doctrine, tools, you.
const FILES = [
  "coach-persona.md",
  "adams-doctrine.md",
  "reframes-library.md",
  "daily-wisdom.md",
  "your-profile.md",
] as const;

let cache: string | null = null;

export async function loadKnowledge(): Promise<string> {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "coach-knowledge");
  const parts = await Promise.all(
    FILES.map(async (f) => {
      const text = await readFile(path.join(dir, f), "utf8");
      return `===== ${f} =====\n${text.trim()}`;
    })
  );
  cache = parts.join("\n\n");
  return cache;
}
