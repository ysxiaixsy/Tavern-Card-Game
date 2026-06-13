/**
 * Generate the app icon / adaptive icon / splash from a single original SVG
 * emblem (no CDPR assets): a fanned trio of cards with a faceted gold gem —
 * the in-game life token — on the dark tavern palette. Run: npm run gen:icons
 *
 * Outputs (overwrites): assets/icon.png, assets/adaptive-foreground.png,
 * assets/splash.png. Re-run after editing the emblem below.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ASSETS = join(import.meta.dirname ?? '.', '..', 'assets');
mkdirSync(ASSETS, { recursive: true });

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#221813"/>
      <stop offset="1" stop-color="#0b0805"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6d490"/>
      <stop offset="0.5" stop-color="#d4af6a"/>
      <stop offset="1" stop-color="#9c7836"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#d4af6a" stop-opacity="0.40"/>
      <stop offset="1" stop-color="#d4af6a" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

/** The emblem, drawn around centre (512, 530). */
const EMBLEM = `
  <circle cx="512" cy="530" r="380" fill="url(#glow)"/>
  <rect x="362" y="320" width="300" height="420" rx="26" fill="#241a12"
        stroke="#d4af6a" stroke-width="7" opacity="0.9" transform="rotate(-15 512 540)"/>
  <rect x="362" y="320" width="300" height="420" rx="26" fill="#241a12"
        stroke="#d4af6a" stroke-width="7" opacity="0.9" transform="rotate(15 512 540)"/>
  <rect x="367" y="300" width="290" height="430" rx="30" fill="#18110b" stroke="url(#gold)" stroke-width="13"/>
  <polygon points="512,432 602,520 512,608 422,520" fill="url(#gold)" stroke="#f6d490" stroke-width="4"/>
  <polygon points="512,432 602,520 512,520" fill="#f6d490" opacity="0.55"/>
  <polygon points="512,608 422,520 512,520" fill="#6f5328" opacity="0.55"/>`;

function svg(body: string, background?: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
      DEFS +
      (background ? `<rect width="1024" height="1024" rx="0" fill="${background}"/>` : '') +
      body +
      `</svg>`,
  );
}

/** Wrap the emblem in a scale transform around the canvas centre. */
function scaled(factor: number): string {
  return `<g transform="translate(512 512) scale(${factor}) translate(-512 -512)">${EMBLEM}</g>`;
}

async function render(name: string, buffer: Buffer): Promise<void> {
  await sharp(buffer).png().toFile(join(ASSETS, name));
  console.log(`  ${name}`);
}

async function main(): Promise<void> {
  console.log('Generating icons:');
  // Full-bleed icon (iOS + generic): dark background + emblem.
  await render('icon.png', svg(scaled(0.86), 'url(#bg)'));
  // Android adaptive foreground: transparent, emblem kept inside the safe zone.
  await render('adaptive-foreground.png', svg(scaled(0.66)));
  // Splash: transparent emblem (dark backgroundColor comes from app.json).
  await render('splash.png', svg(scaled(0.7)));
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
