/**
 * Faction emblem shields (user-supplied art, imported via
 * `npm run import:factions`). Used by faction pickers.
 */

import type { PlayableFaction } from './store';

export const FACTION_EMBLEM: Record<PlayableFaction, number> = {
  northern_realms: require('../../assets/factions/northern_realms.webp') as number,
  nilfgaard: require('../../assets/factions/nilfgaard.webp') as number,
  monsters: require('../../assets/factions/monsters.webp') as number,
  scoiatael: require('../../assets/factions/scoiatael.webp') as number,
  skellige: require('../../assets/factions/skellige.webp') as number,
};
