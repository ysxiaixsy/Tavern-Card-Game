/**
 * AI opponent deck selection & construction (vs-AI setup).
 *
 *  - pickAiDeck: faction is UNIFORMLY random; the deck within that faction is
 *    difficulty-weighted (harder AIs take the strongest deck available).
 *  - buildAiDeck: the AI drafts its own legal deck from the faction pool,
 *    greedy by card worth, with difficulty-scaled noise.
 *
 * Pure and deterministic per seed (engine rng); no React/store imports. Deck
 * legality is the engine's validateDeck — never re-implemented here.
 */

import { CARD_DEFS, getCardDef, leadersOf } from '../engine/data/cards.ts';
import { STARTER_DECKS } from '../engine/data/decks.ts';
import { MIN_DECK_CARDS, MIN_UNIT_CARDS, validateDeck } from '../engine/game.ts';
import { rngInt, seedToRngState } from '../engine/rng.ts';
import type { CardDef, DeckList } from '../engine/types.ts';
import type { Difficulty } from './agent.ts';
import { cardWorth } from './normal.ts';

export type BuildFaction = keyof typeof STARTER_DECKS;
export const BUILD_FACTIONS = Object.keys(STARTER_DECKS) as BuildFaction[];

/** Minimal deck shape shared with the store's SavedDeck. */
export interface DeckOption {
  id: string;
  faction: BuildFaction;
  leaderId: string;
  cardIds: string[];
}

/** Deck power estimate: summed card worth + a nudge for a strong leader. */
export function deckStrength(deck: { leaderId: string; cardIds: string[] }): number {
  let total = leaderRank(getCardDef(deck.leaderId)) * 4;
  for (const id of deck.cardIds) {
    total += cardWorth(getCardDef(id));
  }
  return total;
}

/** Random faction; within it, the deck choice sharpens with difficulty. */
export function pickAiDeck(decks: DeckOption[], difficulty: Difficulty, seed: string): DeckOption {
  let rng = seedToRngState(`pick|${seed}`);
  const [factionIndex, rng1] = rngInt(rng, BUILD_FACTIONS.length);
  rng = rng1;
  const faction = BUILD_FACTIONS[factionIndex];
  const pool = decks.filter((d) => d.faction === faction);
  // Starters guarantee ≥1 deck per faction; guard anyway.
  if (pool.length === 0) {
    return decks[0];
  }
  const strongest = pool.reduce((a, b) => (deckStrength(b) > deckStrength(a) ? b : a));
  switch (difficulty) {
    case 'hard':
    case 'witcher':
      return strongest;
    case 'normal': {
      const [roll, rng2] = rngInt(rng, 100);
      rng = rng2;
      if (roll < 60) {
        return strongest;
      }
      const [i] = rngInt(rng, pool.length);
      return pool[i];
    }
    default: {
      const [i] = rngInt(rng, pool.length);
      return pool[i];
    }
  }
}

/** Card value for DRAFTING (cardWorth underrates a row-doubling horn). */
function draftWorth(def: CardDef): number {
  if (def.type === 'horn') {
    return 40;
  }
  return cardWorth(def);
}

/** Leader strength ranking by ability (higher = better). */
const LEADER_ABILITY_RANK: Record<string, number> = {
  draw_extra_start: 10, // a whole extra card — card advantage is king
  discard_draw: 9,
  steal_from_graveyard: 8,
  restore_to_hand: 8,
  row_horn: 6,
  cancel_leader: 5,
  reshuffle_graveyards: 4,
  halve_weather: 4,
  spy_double_passive: 4,
  realign_agile: 3,
  clear_weather: 3,
  weather_from_deck: 2,
  scorch_row_leader: 2,
  peek_hand: 1,
  restore_random_passive: 1,
};

function leaderRank(def: CardDef): number {
  return LEADER_ABILITY_RANK[def.leaderAbility ?? ''] ?? 0;
}

/**
 * Draft a legal deck from the faction pool: best 22 units + best 3 extras
 * (25 cards total keeps spy draws dense). Difficulty adds draft noise —
 * easy AIs pick odd cards, hard/witcher draft cleanly.
 */
export function buildAiDeck(
  faction: BuildFaction | 'surprise',
  difficulty: Difficulty,
  seed: string,
): DeckList {
  let rng = seedToRngState(`build|${seed}`);
  let picked: BuildFaction;
  if (faction === 'surprise') {
    const [i, rng1] = rngInt(rng, BUILD_FACTIONS.length);
    rng = rng1;
    picked = BUILD_FACTIONS[i];
  } else {
    picked = faction;
  }

  const noiseSpan = difficulty === 'easy' ? 45 : difficulty === 'normal' ? 15 : 0;
  interface Copy {
    defId: string;
    isUnit: boolean;
    value: number;
  }
  const copies: Copy[] = [];
  for (const def of CARD_DEFS) {
    if (
      def.type === 'leader' ||
      (def.maxCopiesPerDeck ?? 1) === 0 ||
      (def.faction !== picked && def.faction !== 'neutral')
    ) {
      continue;
    }
    const isUnit = def.type === 'unit' || def.type === 'hero';
    for (let i = 0; i < (def.maxCopiesPerDeck ?? 1); i++) {
      let noise = 0;
      if (noiseSpan > 0) {
        const [n, next] = rngInt(rng, noiseSpan);
        rng = next;
        noise = n;
      }
      copies.push({ defId: def.id, isUnit, value: draftWorth(def) + noise });
    }
  }
  copies.sort((a, b) => b.value - a.value);

  const units = copies.filter((c) => c.isUnit).slice(0, MIN_UNIT_CARDS);
  const taken = new Set(units);
  const extras = copies.filter((c) => !taken.has(c)).slice(0, MIN_DECK_CARDS - units.length);
  const cardIds = [...units, ...extras].map((c) => c.defId);

  // Leader: hard/witcher take the best-ranked variant; others pick randomly.
  const leaders = leadersOf(picked);
  let leaderId: string;
  if (difficulty === 'hard' || difficulty === 'witcher') {
    leaderId = leaders.reduce((a, b) => (leaderRank(b) > leaderRank(a) ? b : a)).id;
  } else {
    const [i] = rngInt(rng, leaders.length);
    leaderId = leaders[i].id;
  }

  const deck: DeckList = { leaderId, cardIds };
  try {
    validateDeck(deck);
    return deck;
  } catch {
    // Should be unreachable (every faction pool covers the minimums); the
    // starter is the safe fallback.
    return STARTER_DECKS[picked];
  }
}
