/**
 * Build src/ui/cardArt.ts — a map of card defId → require(image) — by scanning
 * the (gitignored) assets/cards/ folder. Run: npm run gen:art
 *
 * Two matchers:
 *  - The base-faction folders (Neutral, NRealms, Nilfgaard, Monster, Scoiatael)
 *    hold "<Faction>-NNN-DescriptiveName.png" files matched to CARD_DEFS by
 *    normalized name (duplicates for multi-copy cards share one def, first wins).
 *  - Everything irregular — the Skellige/ folder, the descriptively-named
 *    leaders/, and a handful of bare-named neutrals (cow, godimm, …) — is mapped
 *    explicitly via NAME_MAP (filename stem → defId).
 *
 * Prints a coverage report; any unmatched card keeps the programmatic frame.
 * The output (src/ui/cardArt.ts) is committed alongside assets/cards/ so EAS
 * cloud builds ship the art — keep this repo private if it ever gets a remote.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CARD_DEFS } from '../src/engine/data/cards.ts';
import type { Faction } from '../src/engine/types.ts';

const root = join(import.meta.dirname ?? '.', '..');
const cardsDir = join(root, 'assets', 'cards');

/** Folder → faction for the name-matcher; null folders are NAME_MAP-only. */
const FOLDER_FACTION: Record<string, Faction | null> = {
  Neutral: 'neutral',
  NRealms: 'northern_realms',
  Nilfgaard: 'nilfgaard',
  Monster: 'monsters',
  Scoiatael: 'scoiatael',
  Skellige: null,
  leaders: null,
};

/** Explicit filename-stem → defId for every irregularly-named asset. */
const NAME_MAP: Record<string, string> = {
  // Bare-named neutrals / expansion specials
  cow: 'neu_cow',
  godimm: 'neu_godimm',
  godimm_darkness: 'neu_godimm_darkness',
  olgierd: 'neu_olgierd',
  toad: 'mon_toad',
  schirru: 'st_schirru',
  skelligestorm: 'sk_storm',
  // Scoiatael name-spelling stragglers
  'Scoiatael-003-IsengrimFaolitarna': 'st_isengrim',
  'Scoiatael-026-CiaranAepEasnillien': 'st_ciaran',
  // Skellige folder (skellige_<name>.png, with clan abbreviations)
  skellige_berseker: 'sk_berserker',
  skellige_young_berserker: 'sk_young_berserker',
  skellige_mardroeme: 'sk_mardroeme',
  skellige_hjalmar: 'sk_hjalmar',
  skellige_cerys: 'sk_cerys',
  skellige_ermion: 'sk_ermion',
  skellige_kambi: 'sk_kambi',
  skellige_birna_bran: 'sk_birna',
  skellige_draig_bondhu: 'sk_draig',
  skellige_cheymaey_skald: 'sk_skald',
  skellige_cdrummond_shield_maiden: 'sk_shieldmaiden',
  skellige_cac_warrior: 'sk_craite_warrior',
  skellige_war_longgship: 'sk_war_longship',
  skellige_light_longship: 'sk_light_longship',
  skellige_ctordarroch_armorsmith: 'sk_armorsmith',
  skellige_cbrokvar_archer: 'sk_brokvar',
  skellige_cdimun_pirate: 'sk_dimun',
  skellige_donar_an_hindar: 'sk_donar',
  skellige_holger_blackhand: 'sk_holger',
  skellige_udalryk: 'sk_udalryk',
  skellige_svanrige: 'sk_svanrige',
  skellige_madman_lugos: 'sk_madman_lugos',
  skellige_blueboy_lugos: 'sk_blueboy_lugos',
  skellige_olaf: 'sk_olaf',
  // Leaders (descriptive names; 5 per base faction + Skellige's two)
  emhyr_imperial: 'ng_emhyr',
  emhyr_whiteflame: 'ng_emhyr_whiteflame',
  emhyr_emperor: 'ng_emhyr_emperor',
  emhyr_relentless: 'ng_emhyr_relentless',
  emhyr_invader: 'ng_emhyr_invader',
  eredin_bringer: 'mon_eredin',
  eredin_king: 'mon_eredin_king',
  eredin_commander: 'mon_eredin_redriders',
  eredin_destroyer: 'mon_eredin_destroyer',
  eredin_treacherous: 'mon_eredin_treacherous',
  foltest_king: 'nr_foltest',
  foltest_lord: 'nr_foltest_commander',
  foltest_siegemaster: 'nr_foltest_siegemaster',
  foltest_steel: 'nr_foltest_steelforged',
  foltest_son_of_medell: 'nr_foltest_medell',
  francesca_daisy: 'st_francesca',
  francesca_pureblood: 'st_francesca_pureblood',
  francesca_beautiful: 'st_francesca_beautiful',
  francesca_queen: 'st_francesca_queen',
  francesca_hope: 'st_francesca_hope',
  bran: 'sk_bran',
  crach1: 'sk_crach',
};

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const stem = (file: string): string => file.replace(IMAGE_RE, '');

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const requirePath = (absFile: string): string => {
  let p = relative(join(root, 'src', 'ui'), absFile).split('\\').join('/');
  if (!p.startsWith('.')) {
    p = `./${p}`;
  }
  return p;
};

const map: Record<string, string> = {};
const unmatchedFiles: string[] = [];

function readDir(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => IMAGE_RE.test(f));
  } catch {
    return [];
  }
}

for (const [folder, faction] of Object.entries(FOLDER_FACTION)) {
  const dir = join(cardsDir, folder);
  const defs = faction ? CARD_DEFS.filter((d) => d.faction === faction && d.type !== 'leader') : [];
  for (const file of readDir(dir)) {
    const mapped = NAME_MAP[stem(file)];
    if (mapped) {
      if (!map[mapped]) {
        map[mapped] = requirePath(join(dir, file));
      }
      continue;
    }
    if (!faction) {
      unmatchedFiles.push(`${folder}/${file}`);
      continue;
    }
    const key = norm(stem(file).split('-').slice(2).join('-'));
    const def =
      defs.find((d) => norm(d.name) === key) ??
      defs.find((d) => norm(d.name).startsWith(key) || key.startsWith(norm(d.name)));
    if (def) {
      if (!map[def.id]) {
        map[def.id] = requirePath(join(dir, file));
      }
    } else {
      unmatchedFiles.push(`${folder}/${file}`);
    }
  }
}

// Report.
const deckable = CARD_DEFS.filter((d) => (d.maxCopiesPerDeck ?? 1) > 0);
const missing = deckable.filter((d) => !map[d.id]);
console.log(`Matched art for ${Object.keys(map).length} / ${deckable.length} deckable cards.`);
if (unmatchedFiles.length > 0) {
  console.log(`Unmatched files (${unmatchedFiles.length}): ${unmatchedFiles.join(', ')}`);
}
console.log(`No art (programmatic fallback): ${missing.map((d) => d.id).join(', ') || 'none'}`);

const entries = Object.entries(map)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, p]) => `  '${id}': require('${p}'),`)
  .join('\n');

writeFileSync(
  join(root, 'src', 'ui', 'cardArt.ts'),
  `/* GENERATED by npm run gen:art — defId -> bundled card image.\n` +
    ` * Unmatched cards use the programmatic CardView frame. */\n` +
    `export const CARD_ART: Record<string, number> = {\n${entries}\n};\n`,
);
console.log('Wrote src/ui/cardArt.ts');
