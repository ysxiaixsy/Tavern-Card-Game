/**
 * Print the full card database as a table: `npm run cards`
 * Handy for verifying stats/rows/abilities against the Witcher wiki.
 */

import { CARD_DEFS } from '../src/engine/data/cards.ts';
import type { CardDef, Faction } from '../src/engine/types.ts';

const FACTIONS: { key: Faction; label: string }[] = [
  { key: 'neutral', label: 'NEUTRAL' },
  { key: 'northern_realms', label: 'NORTHERN REALMS' },
  { key: 'nilfgaard', label: 'NILFGAARD' },
  { key: 'monsters', label: 'MONSTERS' },
  { key: 'scoiatael', label: "SCOIA'TAEL" },
  { key: 'skellige', label: 'SKELLIGE' },
];

function describe(def: CardDef): string {
  if (def.type === 'leader') {
    const extra = def.leaderWeather ?? def.leaderHornRow ?? def.leaderScorchRow;
    return `leader: ${def.leaderAbility}${extra ? ` (${extra})` : ''}`;
  }
  if (def.type === 'weather') {
    return `weather: ${def.weather}`;
  }
  if (def.type !== 'unit' && def.type !== 'hero') {
    return def.type;
  }
  const bits: string[] = [`${def.row}`, `str ${def.strength ?? 0}`];
  if (def.type === 'hero') {
    bits.unshift('HERO');
  }
  if (def.abilities.length > 0) {
    bits.push(def.abilities.join('+'));
  }
  if (def.musterGroup) {
    bits.push(`group:${def.musterGroup}`);
  }
  return bits.join(', ');
}

let total = 0;
for (const { key, label } of FACTIONS) {
  const defs = CARD_DEFS.filter((d) => d.faction === key && d.maxCopiesPerDeck !== 0);
  const leaders = defs.filter((d) => d.type === 'leader');
  const units = defs.filter((d) => d.type === 'unit' || d.type === 'hero');
  const specials = defs.filter(
    (d) => d.type !== 'leader' && d.type !== 'unit' && d.type !== 'hero',
  );
  total += defs.length;

  console.log(`\n══ ${label} ═════════════════════════ (${defs.length} cards)`);
  for (const group of [leaders, units, specials]) {
    for (const def of group) {
      const copies = (def.maxCopiesPerDeck ?? 1) > 1 ? `  ×${def.maxCopiesPerDeck}` : '';
      console.log(`  ${def.name.padEnd(42)} ${describe(def)}${copies}`);
    }
    if (group.length > 0) {
      console.log('');
    }
  }
}
console.log(`Total card definitions: ${total} (+ 1 internal leader-horn marker)`);
