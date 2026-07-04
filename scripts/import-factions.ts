/**
 * Faction emblem importer: `npm run import:factions`.
 * Reads the emblem images from the Desktop assets folder, resizes to 256px
 * WebP and writes them into assets/factions/ (committed, bundled).
 */

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'C:/Users/acer/Desktop/gwent assets/factions';
const OUT = path.join(__dirname, '..', 'assets', 'factions');

const FILES: Record<string, string> = {
  monsters: 'monsters.png',
  nilfgaard: 'nilfgaard.png',
  northern_realms: 'nrealms.png',
  scoiatael: 'scoiatael.png',
  skellige: 'skellige.png',
};

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  for (const [name, file] of Object.entries(FILES)) {
    await sharp(path.join(SRC, file))
      .resize(256, 256, { fit: 'inside' })
      .webp({ quality: 88 })
      .toFile(path.join(OUT, `${name}.webp`));
    console.log(`wrote ${name}.webp`);
  }
}

void main();
