/**
 * One-shot card-art importer. Copies new images from your Desktop art folder
 * into assets/cards/, then runs optimize:art + gen:art. Run: npm run art:import
 *
 *  - Source defaults to "C:\\Users\\acer\\Desktop\\gwent assets"; override with
 *    `npm run art:import -- "D:\\some\\other\\folder"` or $GWENT_ART_SRC.
 *  - Filenames are sanitized (spaces → underscores). A few oddly-named files get
 *    a friendly repo name via RENAME so they line up with NAME_MAP in
 *    gen-card-art.ts.
 *  - A card is skipped if its .webp already exists (incremental). Pass --force
 *    to re-copy and re-encode everything (use when you've updated existing art).
 *
 * After copying it always runs optimize:art then gen:art, so the require-map
 * and the coverage report are refreshed in one go.
 */

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname ?? '.', '..');
const args = process.argv.slice(2).filter((a) => a !== '--force');
const force = process.argv.includes('--force');
const SRC = args[0] ?? process.env.GWENT_ART_SRC ?? 'C:\\Users\\acer\\Desktop\\gwent assets';

/** Card folders to mirror (the `factions/` emblems are not cards — skipped). */
const FOLDERS = ['Neutral', 'NRealms', 'Nilfgaard', 'Monster', 'Scoiatael', 'Skellige', 'leaders'];
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

/** Sanitized stem → friendly repo stem (matches NAME_MAP in gen-card-art.ts). */
const RENAME: Record<string, string> = {
  Tw3_gwent_face_Hemdall: 'hemdall',
  transformed_vildkaarl: 'vildkaarl',
  transformed_young_vildkaarl: 'young_vildkaarl',
};

let copied = 0;
let skipped = 0;
const imported: string[] = [];

for (const folder of FOLDERS) {
  const srcDir = join(SRC, folder);
  let files: string[];
  try {
    files = readdirSync(srcDir).filter((f) => IMAGE_RE.test(f));
  } catch {
    continue; // folder not present in the source — fine
  }
  const destDir = join(root, 'assets', 'cards', folder);
  mkdirSync(destDir, { recursive: true });

  for (const file of files) {
    const ext = (file.match(IMAGE_RE) as RegExpMatchArray)[0];
    const sanitized = file.slice(0, -ext.length).replace(/\s+/g, '_');
    const finalStem = RENAME[sanitized] ?? sanitized;
    const destWebp = join(destDir, `${finalStem}.webp`);
    if (!force && existsSync(destWebp)) {
      skipped += 1;
      continue;
    }
    copyFileSync(join(srcDir, file), join(destDir, `${finalStem}${ext.toLowerCase()}`));
    imported.push(`${folder}/${finalStem}${ext.toLowerCase()}`);
    copied += 1;
  }
}

console.log(`Source: ${SRC}`);
console.log(`Imported ${copied} new file(s)${force ? ' (forced)' : ''}, skipped ${skipped} existing.`);
if (imported.length > 0) {
  console.log(imported.map((f) => `  + ${f}`).join('\n'));
}

console.log('\n--- optimize:art ---');
execSync('npm run optimize:art', { cwd: root, stdio: 'inherit' });
console.log('\n--- gen:art ---');
execSync('npm run gen:art', { cwd: root, stdio: 'inherit' });
