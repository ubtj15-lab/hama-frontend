/**
 * PWA/애플 터치용 PNG 생성 — `npm run generate:pwa-icons` (apps/hama)
 * sharp 설치: npm i -D sharp
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");
const primary = "#2563eb";
const onPrimary = "#ffffff";

function roundedIconSvg(size, radiusRatio) {
  const r = Math.round(size * radiusRatio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${primary}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="${onPrimary}" font-family="system-ui,Segoe UI,sans-serif" font-weight="800" font-size="${Math.round(size * 0.38)}">H</text>
</svg>`
  );
}

function maskableSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${primary}"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="${onPrimary}" font-family="system-ui,Segoe UI,sans-serif" font-weight="800" font-size="${Math.round(size * 0.3)}">H</text>
</svg>`
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await sharp(roundedIconSvg(192, 0.2)).png().toFile(path.join(outDir, "icon-192.png"));
  await sharp(roundedIconSvg(512, 0.2)).png().toFile(path.join(outDir, "icon-512.png"));
  await sharp(maskableSvg(512)).png().toFile(path.join(outDir, "icon-maskable-512.png"));
  await sharp(roundedIconSvg(180, 0.2)).png().toFile(path.join(outDir, "apple-touch-icon.png"));

  console.log("Wrote:", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
