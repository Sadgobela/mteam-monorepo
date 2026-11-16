// Draws the installable app's icons from the logo's mark in src/components/Logo.tsx: white on the brand purple, as the
// logo rules ask for on purple. Run from apps/web after the logo changes: node scripts/make-icons.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#986DC6";
const MARK_SIZE = 319.89;
const mark = /const MARK = "([^"]+)"/.exec(readFileSync("src/components/Logo.tsx", "utf8"))?.[1];
if (!mark) throw new Error("The MARK path was not found in Logo.tsx");

/** One square icon: the mark takes `share` of the side, centred; `round` rounds the corners for icons shown as they are. */
function svg(size, share, round) {
  const scale = (size * share) / MARK_SIZE;
  const offset = (size - size * share) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${round ? size * 0.22 : 0}" fill="${BRAND}"/>
<path transform="translate(${offset} ${offset}) scale(${scale})" fill="#ffffff" d="${mark}"/>
</svg>`;
}

const icons = [
  ["public/icons/icon-192.png", 192, 0.6, true],
  ["public/icons/icon-512.png", 512, 0.6, true],
  // Android crops maskable icons to a shape inside the middle 80%, so the mark stays well within it.
  ["public/icons/icon-maskable-512.png", 512, 0.5, false],
  // iOS rounds the corners itself and shows any transparency as black.
  ["src/app/apple-icon.png", 180, 0.6, false],
];

for (const [file, size, share, round] of icons) {
  await sharp(Buffer.from(svg(size, share, round))).png({ compressionLevel: 9 }).toFile(file);
  console.info(`${file} ${size}px`);
}
