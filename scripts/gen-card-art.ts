/**
 * Build src/ui/cardArt.ts — a map of card defId → require(image) — by scanning
 * the (gitignored) assets/cards/ folder and matching filenames to CARD_DEFS by
 * normalized card name. Run: npm run gen:art
 *
 * Card folders: Neutral, NRealms, Nilfgaard, Monster, Scoiatael (one PNG per
 * card, named "<Faction>-NNN-DescriptiveName.png"; duplicates for multi-copy
 * cards share one def, first file wins). leaders/<base><1..N>.png map to the
 * Nth leader of that faction in data order. Prints a coverage report; any
 * unmatched card simply keeps the programmatic frame.
 *
 * The output (src/ui/cardArt.ts) is committed alongside assets/cards/ so EAS
 * cloud builds ship the art — keep this repo private if it ever gets a remote.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CARD_DEFS } from '../src/engine/data/cards.ts';
import type { Faction } from '../src/engine/types.ts';

const root = join(import.meta.dirname ?? '.', '..');
const cardsDir = join(root, 'assets', 'cards');

const FOLDER_FACTION: Record<string, Faction> = {
  Neutral: 'neutral',
  NRealms: 'northern_realms',
  Nilfgaard: 'nilfgaard',
  Monster: 'monsters',
  Scoiatael: 'scoiatael',
};
const LEADER_BASE: Record<string, Faction> = {
  foltest: 'northern_realms',
  emhyr: 'nilfgaard',
  eredin: 'monsters',
  francesca: 'scoiatael',
};

/** Leader files whose name isn't `<base><N>` (Skellige's two leaders). */
const LEADER_OVERRIDES: Record<string, string> = {
  // filename stem: defId
  crach1: 'sk_crach',
  bran: 'sk_bran',
};

/**
 * The Skellige/ folder uses its own `skellige_<name>.png` naming with clan
 * abbreviations, so it gets an explicit filename-stem → defId map rather than
 * the normalized-name matcher used for the other faction folders.
 */
const SKELLIGE_MAP: Record<string, string> = {
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
  // skellige_blueboy_lugos / skellige_olaf have no matching card def.
};

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const stem = (file: string): string => file.replace(IMAGE_RE, '');

/** Hand-mapped stragglers whose filename spelling won't auto-match the def. */
const OVERRIDES: Record<string, string> = {
  // defId: filename stem (no extension)
  st_isengrim: 'Scoiatael-003-IsengrimFaolitarna',
  st_ciaran: 'Scoiatael-026-CiaranAepEasnillien',
};

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

// Units & specials, matched by normalized name within each faction folder.
for (const [folder, faction] of Object.entries(FOLDER_FACTION)) {
  const dir = join(cardsDir, folder);
  const defs = CARD_DEFS.filter((d) => d.faction === faction && d.type !== 'leader');
  for (const file of readDir(dir)) {
    const override = Object.entries(OVERRIDES).find(([, s]) => s === stem(file));
    if (override) {
      if (!map[override[0]]) {
        map[override[0]] = requirePath(join(dir, file));
      }
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

// Skellige folder: explicit filename-stem → defId map (irregular names).
const skelligeDir = join(cardsDir, 'Skellige');
for (const file of readDir(skelligeDir)) {
  const defId = SKELLIGE_MAP[stem(file)];
  if (defId) {
    if (!map[defId]) {
      map[defId] = requirePath(join(skelligeDir, file));
    }
  } else {
    unmatchedFiles.push(`Skellige/${file}`);
  }
}

// Leaders. First the explicit overrides (Skellige's Crach/Bran), then the
// `<base><index>.png` → Nth-leader-of-faction rule for the base factions.
const leaderDir = join(cardsDir, 'leaders');
const leaderFiles = readDir(leaderDir);
for (const file of leaderFiles) {
  const defId = LEADER_OVERRIDES[stem(file)];
  if (defId && !map[defId]) {
    map[defId] = requirePath(join(leaderDir, file));
  }
}
for (const [base, faction] of Object.entries(LEADER_BASE)) {
  const leaders = CARD_DEFS.filter((d) => d.faction === faction && d.type === 'leader');
  leaders.forEach((leader, i) => {
    const file = leaderFiles.find((f) => norm(stem(f)) === `${base}${i + 1}`);
    if (file && !map[leader.id]) {
      map[leader.id] = requirePath(join(leaderDir, file));
    }
  });
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
