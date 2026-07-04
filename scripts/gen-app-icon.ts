/**
 * App icon generator: `npm run gen:icon`.
 * Takes the gold "G" medallion from the Desktop assets folder and produces:
 *   assets/icon.png                (1024², medallion on the app's dark oak)
 *   assets/adaptive-foreground.png (1024², medallion at ~72% for the safe zone)
 *   assets/splash.png              (1024², medallion at 55% on transparent)
 *   assets/favicon.png             (64², web)
 */

import path from 'node:path';
import sharp from 'sharp';

const SRC = 'C:/Users/acer/Desktop/gwent assets/icon.png';
const OUT = path.join(__dirname, '..', 'assets');
const BG = '#16100b'; // app.json backgroundColor

async function medallion(size: number): Promise<Buffer> {
  return sharp(SRC).resize(size, size, { fit: 'inside' }).png().toBuffer();
}

async function onCanvas(
  canvas: number,
  content: number,
  background: string | { r: number; g: number; b: number; alpha: number },
): Promise<sharp.Sharp> {
  const inner = await medallion(content);
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background },
  }).composite([{ input: inner, gravity: 'center' }]);
}

async function main(): Promise<void> {
  // Main icon: medallion nearly full-bleed on the dark tavern color.
  await (await onCanvas(1024, 920, BG)).png().toFile(path.join(OUT, 'icon.png'));
  // Android adaptive foreground: keep the medallion inside the ~66% safe zone.
  await (await onCanvas(1024, 720, { r: 0, g: 0, b: 0, alpha: 0 }))
    .png()
    .toFile(path.join(OUT, 'adaptive-foreground.png'));
  // Splash image (rendered 200px wide, contain, over the same background).
  await (await onCanvas(1024, 560, { r: 0, g: 0, b: 0, alpha: 0 }))
    .png()
    .toFile(path.join(OUT, 'splash.png'));
  // Web favicon.
  await (await onCanvas(64, 60, { r: 0, g: 0, b: 0, alpha: 0 }))
    .png()
    .toFile(path.join(OUT, 'favicon.png'));
  console.log('wrote icon.png, adaptive-foreground.png, splash.png, favicon.png');
}

void main();
