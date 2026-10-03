// Generates every icon from resources/icons/icon.svg plus the tray state icons.
// Outputs are committed so normal builds don't depend on sharp.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "resources", "icons");
const buildDir = join(root, "build");
mkdirSync(buildDir, { recursive: true });

const appSvg = readFileSync(join(dir, "icon.svg"));
const png = (svg, size) => sharp(Buffer.isBuffer(svg) ? svg : Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

// App icon: exe, installer, window.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoPngs = await Promise.all(icoSizes.map((s) => png(appSvg, s)));
const ico = await pngToIco(icoPngs);
writeFileSync(join(buildDir, "icon.ico"), ico);
writeFileSync(join(dir, "icon.ico"), ico);
writeFileSync(join(dir, "icon.png"), await png(appSvg, 512));
writeFileSync(join(root, "src", "renderer", "public", "icon.svg"), appSvg);

// Tray: a simplified glyph that stays legible at 16px, one colour per state.
const tray = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="${fill}"/>
  <rect x="13.5" y="4.5" width="4" height="8" rx="2" fill="#fff" fill-opacity="0.6"/>
  <rect x="13.5" y="19.5" width="4" height="8" rx="2" fill="#fff" fill-opacity="0.6"/>
  <path d="M6.5 16 H23" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M19 11 L24.5 16 L19 21" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const states = {
  active: "#8050F2",
  idle: "#5E5670",
  busy: "#D99A1E",
  error: "#D9475A",
};
for (const [name, fill] of Object.entries(states)) {
  writeFileSync(join(dir, `tray-${name}.png`), await png(tray(fill), 16));
  writeFileSync(join(dir, `tray-${name}@2x.png`), await png(tray(fill), 32));
}

console.log("icons: generated");
