// Generate PWA icons from an inline SVG using sharp (already a Next dependency).
// Run: node scripts/gen-icons.mjs
// Full-bleed dark background with the amber "rising energy" mark kept inside the
// maskable safe zone, so one source serves any / maskable / apple-touch.

import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const OUT = path.join(process.cwd(), "public");

// viewBox 512. Content within the central ~80% safe zone for maskable icons.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0d"/>
  <polyline points="150,346 224,300 292,322 366,180"
    fill="none" stroke="#f5a524" stroke-width="34"
    stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="366" cy="180" r="27" fill="#f5a524"/>
</svg>`;

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
];

await mkdir(OUT, { recursive: true });
const buf = Buffer.from(svg);
for (const t of targets) {
  await sharp(buf).resize(t.size, t.size).png().toFile(path.join(OUT, t.name));
  console.log("wrote", t.name);
}
console.log("Icons generated in /public.");
