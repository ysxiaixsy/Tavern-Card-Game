/**
 * Shrink the (gitignored) card-art copies in assets/cards/ so the bundle stays
 * small. The source PNGs are ~4MB full-res card faces; cards never render larger
 * than the 220x300 detail view (~660x900 @3x), so we downscale to 700px wide and
 * re-encode as WebP (RN/Android decode it natively) — PNG is hopeless for
 * photographic art. Converts in place and deletes the originals.
 *
 * Operates IN PLACE on assets/cards/ — these are throwaway copies of the
 * originals on your Desktop, so re-copy + re-run if you need to redo it.
 * Run: npm run optimize:art  (then npm run gen:art)
 */

import { readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const MAX_WIDTH = 700;
const QUALITY = 80;
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const cardsDir = join(import.meta.dirname ?? '.', '..', 'assets', 'cards');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      return walk(p);
    }
    return e.isFile() && IMAGE_RE.test(e.name) ? [p] : [];
  });
}

const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(1)}MB`;

async function main(): Promise<void> {
  const files = walk(cardsDir);
  let before = 0;
  let after = 0;
  let resized = 0;

  for (const file of files) {
    before += statSync(file).size;
    const meta = await sharp(file).metadata();
    const downscale = !!meta.width && meta.width > MAX_WIDTH;
    const out = await sharp(file)
      .resize(downscale ? { width: MAX_WIDTH } : {})
      .webp({ quality: QUALITY })
      .toBuffer();
    const webpPath = file.replace(IMAGE_RE, '.webp');
    writeFileSync(webpPath, out);
    if (webpPath !== file) {
      unlinkSync(file);
    }
    after += out.length;
    if (downscale) {
      resized += 1;
    }
  }

  console.log(`Optimized ${files.length} images -> WebP (${resized} downscaled to ${MAX_WIDTH}px).`);
  console.log(`Total: ${mb(before)} -> ${mb(after)}`);
}

void main();
