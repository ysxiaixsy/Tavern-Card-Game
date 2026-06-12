/**
 * Game creation, deck validation and terminal check.
 */

import { getCardDef, hasCardDef } from './data/cards.ts';
import { drawCards, PLAYER_IDS } from './helpers.ts';
import { rngInt, rngShuffle, seedToRngState } from './rng.ts';
import {
  GwentError,
  type CardInstance,
  type DeckList,
  type GameConfig,
  type GameState,
  type MatchResult,
  type PlayerId,
  type PlayerState,
  type RowKind,
} from './types.ts';

const HAND_SIZE = 10;
const STARTING_GEMS = 2;

/**
 * Deck-building rules. Units/specials limits are W3's own; the total-size
 * band is a project rule (W3 has no maximum) so the deck builder stays
 * focused: faction + neutral cards together must fit the band.
 */
export const MIN_UNIT_CARDS = 22;
export const MAX_SPECIAL_CARDS = 10;
export const MIN_DECK_CARDS = 25;
export const MAX_DECK_CARDS = 30;

/** Throws GwentError('INVALID_CONFIG') if the deck breaks a deck-building rule. */
export function validateDeck(deck: DeckList): void {
  if (!hasCardDef(deck.leaderId)) {
    throw new GwentError('INVALID_CONFIG', `unknown leader ${deck.leaderId}`);
  }
  const leader = getCardDef(deck.leaderId);
  if (leader.type !== 'leader') {
    throw new GwentError('INVALID_CONFIG', `${leader.name} is not a leader card`);
  }

  let unitCount = 0;
  let specialCount = 0;
  const copies: Record<string, number> = {};

  for (const cardId of deck.cardIds) {
    if (!hasCardDef(cardId)) {
      throw new GwentError('INVALID_CONFIG', `unknown card ${cardId}`);
    }
    const def = getCardDef(cardId);
    if (def.type === 'leader') {
      throw new GwentError('INVALID_CONFIG', `${def.name}: leaders cannot be deck cards`);
    }
    if (def.faction !== 'neutral' && def.faction !== leader.faction) {
      throw new GwentError(
        'INVALID_CONFIG',
        `${def.name} (${def.faction}) cannot join a ${leader.faction} deck`,
      );
    }
    if (def.type === 'unit' || def.type === 'hero') {
      unitCount++;
    } else {
      specialCount++;
    }
    copies[cardId] = (copies[cardId] ?? 0) + 1;
    if (copies[cardId] > (def.maxCopiesPerDeck ?? 1)) {
      throw new GwentError(
        'INVALID_CONFIG',
        `${def.name}: at most ${def.maxCopiesPerDeck ?? 1} cop(y/ies) per deck`,
      );
    }
  }

  if (unitCount < MIN_UNIT_CARDS) {
    throw new GwentError(
      'INVALID_CONFIG',
      `deck has ${unitCount} unit cards; at least ${MIN_UNIT_CARDS} required`,
    );
  }
  if (specialCount > MAX_SPECIAL_CARDS) {
    throw new GwentError(
      'INVALID_CONFIG',
      `deck has ${specialCount} special cards; at most ${MAX_SPECIAL_CARDS} allowed`,
    );
  }
  if (deck.cardIds.length < MIN_DECK_CARDS) {
    throw new GwentError(
      'INVALID_CONFIG',
      `deck has ${deck.cardIds.length} cards; at least ${MIN_DECK_CARDS} required`,
    );
  }
  if (deck.cardIds.length > MAX_DECK_CARDS) {
    throw new GwentError(
      'INVALID_CONFIG',
      `deck has ${deck.cardIds.length} cards; at most ${MAX_DECK_CARDS} allowed`,
    );
  }
}

function emptyRows(): PlayerState['rows'] {
  const rows = {} as Record<RowKind, { units: CardInstance[]; horn: CardInstance | null }>;
  rows.melee = { units: [], horn: null };
  rows.ranged = { units: [], horn: null };
  rows.siege = { units: [], horn: null };
  return rows;
}

/**
 * Create a fresh game: validate decks, shuffle, deal 10 to each player,
 * auto-resolve Francesca's extra draw, then either coin-flip for first
 * player or hand the choice to the (single) Scoia'tael player.
 *
 * The returned state is in the 'mulligan' phase: both players must submit a
 * MULLIGAN move (possibly with an empty swap list) before play begins — and
 * the Scoia'tael first-player choice, when present, resolves before that.
 */
export function createGame(config: GameConfig, seed: string): GameState {
  let rngState = seedToRngState(seed);

  const players = {} as Record<PlayerId, PlayerState>;
  for (const p of PLAYER_IDS) {
    const deckList = config.players[p].deck;
    validateDeck(deckList);
    const leaderDef = getCardDef(deckList.leaderId);

    const instances: CardInstance[] = deckList.cardIds.map((defId, i) => ({
      instanceId: `${p}:${defId}:${i}`,
      defId,
    }));
    const [shuffled, nextRng] = rngShuffle(rngState, instances);
    rngState = nextRng;

    players[p] = {
      faction: leaderDef.faction,
      leader: { instanceId: `${p}:leader`, defId: deckList.leaderId },
      // draw_extra_start leaders are consumed automatically at match start.
      leaderUsed: leaderDef.leaderAbility === 'draw_extra_start',
      gems: STARTING_GEMS,
      hand: shuffled.slice(0, HAND_SIZE),
      deck: shuffled.slice(HAND_SIZE),
      graveyard: [],
      rows: emptyRows(),
      passed: false,
      mulliganDone: false,
      mulligansUsed: 0,
      knownOpponentCardIds: [],
    };
  }

  const [flip, nextRng] = rngInt(rngState, 2);
  rngState = nextRng;
  const flipWinner: PlayerId = flip === 0 ? 'p1' : 'p2';

  const state: GameState = {
    v: 1,
    seed,
    rngState,
    config,
    phase: 'mulligan',
    round: 0,
    turn: flipWinner,
    roundLeader: flipWinner,
    players,
    weatherCards: [],
    pendingChoice: null,
    roundHistory: [],
    result: null,
    moveCount: 0,
  };

  // draw_extra_start (Francesca, Daisy of the Valley): one extra card now.
  for (const p of PLAYER_IDS) {
    if (getCardDef(players[p].leader.defId).leaderAbility === 'draw_extra_start') {
      drawCards(state, p, 1);
    }
  }

  // Scoia'tael perk: when exactly one player runs the elves, they decide who
  // goes first in round 1. In a Scoia'tael mirror the perks cancel out and
  // the coin flip stands (as in W3).
  const st1 = players.p1.faction === 'scoiatael';
  const st2 = players.p2.faction === 'scoiatael';
  if (st1 !== st2) {
    const chooser: PlayerId = st1 ? 'p1' : 'p2';
    state.pendingChoice = { kind: 'choose_first_player', player: chooser };
    state.turn = chooser;
  }

  return state;
}

/** Non-null exactly when the match is over. */
export function isTerminal(state: GameState): MatchResult | null {
  return state.result;
}
