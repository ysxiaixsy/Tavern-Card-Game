import { describe, expect, it } from 'vitest';
import { createGame, validateDeck } from '../game.ts';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../data/decks.ts';
import { getCardDef } from '../data/cards.ts';
import { GwentError, type DeckList, type GameConfig } from '../types.ts';

const STARTER_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

/** A deck of 22 distinct NR/neutral units + the given extras. */
function legalUnits(): string[] {
  return [
    'nr_vernon', 'nr_natalis', 'nr_esterad', 'nr_philippa', 'neu_geralt', 'neu_yennefer',
    'nr_stennis', 'nr_dijkstra', 'nr_thaler', 'nr_dun_banner_medic', 'nr_blue_stripes',
    'nr_crinfrid', 'nr_catapult', 'nr_kaedweni', 'nr_siegfried', 'nr_ves', 'nr_yarpen',
    'nr_sile', 'nr_keira', 'nr_sabrina', 'neu_vesemir', 'neu_zoltan',
  ];
}

describe('deck validation', () => {
  it('accepts both starter decks', () => {
    expect(() => validateDeck(NORTHERN_REALMS_STARTER)).not.toThrow();
    expect(() => validateDeck(MONSTERS_STARTER)).not.toThrow();
  });

  it('requires at least 22 unit cards', () => {
    const deck: DeckList = { leaderId: 'nr_foltest', cardIds: legalUnits().slice(0, 21) };
    expect(() => validateDeck(deck)).toThrowError(GwentError);
  });

  it('allows at most 10 special cards', () => {
    const specials = [
      'neu_frost', 'neu_frost', 'neu_frost',
      'neu_fog', 'neu_fog', 'neu_fog',
      'neu_rain', 'neu_rain', 'neu_rain',
      'neu_clear', 'neu_clear', // 11 specials
    ];
    const deck: DeckList = { leaderId: 'nr_foltest', cardIds: [...legalUnits(), ...specials] };
    expect(() => validateDeck(deck)).toThrowError(GwentError);
  });

  it('rejects cards from a foreign faction', () => {
    const deck: DeckList = {
      leaderId: 'nr_foltest',
      cardIds: [...legalUnits().slice(0, 21), 'mon_fiend'],
    };
    expect(() => validateDeck(deck)).toThrowError(GwentError);
  });

  it('enforces per-card copy limits', () => {
    const deck: DeckList = {
      leaderId: 'nr_foltest',
      cardIds: [...legalUnits().slice(0, 20), 'neu_geralt', 'neu_geralt'], // 2× a 1-copy card
    };
    expect(() => validateDeck(deck)).toThrowError(GwentError);
  });

  it('rejects unknown ids and leaders shuffled in as deck cards', () => {
    expect(() =>
      validateDeck({ leaderId: 'nr_foltest', cardIds: [...legalUnits(), 'no_such_card'] }),
    ).toThrowError(GwentError);
    expect(() =>
      validateDeck({ leaderId: 'nr_foltest', cardIds: [...legalUnits(), 'mon_eredin'] }),
    ).toThrowError(GwentError);
    expect(() => validateDeck({ leaderId: 'neu_geralt', cardIds: legalUnits() })).toThrowError(
      GwentError,
    );
  });
});

describe('createGame', () => {
  it('deals 10 cards each, leaves the rest in the deck, sets up the mulligan phase', () => {
    const state = createGame(STARTER_CONFIG, 'setup-test');
    expect(state.phase).toBe('mulligan');
    expect(state.round).toBe(0);
    expect(state.pendingChoice).toBeNull(); // no Scoia'tael side → coin flip stands
    for (const p of ['p1', 'p2'] as const) {
      const ps = state.players[p];
      expect(ps.hand).toHaveLength(10);
      expect(ps.hand.length + ps.deck.length).toBe(
        STARTER_CONFIG.players[p].deck.cardIds.length,
      );
      expect(ps.gems).toBe(2);
      expect(ps.graveyard).toHaveLength(0);
      expect(getCardDef(ps.leader.defId).type).toBe('leader');
    }
    expect(state.players.p1.faction).toBe('northern_realms');
    expect(state.players.p2.faction).toBe('monsters');
  });

  it('different seeds produce different shuffles', () => {
    const a = createGame(STARTER_CONFIG, 'seed-a');
    const b = createGame(STARTER_CONFIG, 'seed-b');
    const handIds = (s: typeof a, p: 'p1' | 'p2') => s.players[p].hand.map((c) => c.instanceId);
    expect(handIds(a, 'p1')).not.toEqual(handIds(b, 'p1'));
  });

  it('mirror matchups (NR vs NR, MON vs MON) play to completion', async () => {
    const { applyMove } = await import('../apply.ts');
    const { getLegalMoves } = await import('../legal.ts');
    const { rngInt, seedToRngState } = await import('../rng.ts');
    const mirrors: GameConfig[] = [
      { players: { p1: { deck: NORTHERN_REALMS_STARTER }, p2: { deck: NORTHERN_REALMS_STARTER } } },
      { players: { p1: { deck: MONSTERS_STARTER }, p2: { deck: MONSTERS_STARTER } } },
    ];
    for (const [index, config] of mirrors.entries()) {
      let state = createGame(config, `mirror-${index}`);
      let botRng = seedToRngState(`mirror-bot-${index}`);
      let guard = 0;
      while (!state.result) {
        if (++guard > 500) {
          throw new Error('mirror game did not terminate');
        }
        const actor = state.pendingChoice
          ? state.pendingChoice.player
          : state.phase === 'mulligan'
            ? state.players.p1.mulliganDone
              ? 'p2'
              : 'p1'
            : state.turn;
        const moves = getLegalMoves(state, actor);
        const [pick, next] = rngInt(botRng, moves.length);
        botRng = next;
        state = applyMove(state, moves[pick]);
      }
      expect(state.result).not.toBeNull();
    }
  });
});
