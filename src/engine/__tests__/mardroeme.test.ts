import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { validateDeck } from '../game.ts';
import { SKELLIGE_STARTER } from '../data/decks.ts';
import { rowUnitViews } from '../strength.ts';
import type { GameState, Move, PlayerId, RowKind } from '../types.ts';
import { makeState, play } from './testkit.ts';

const defAt = (s: GameState, side: PlayerId, row: RowKind, i = 0): string =>
  s.players[side].rows[row].units[i].defId;
const eff = (s: GameState, side: PlayerId, row: RowKind): number[] =>
  rowUnitViews(s, side, row).map((u) => u.effectiveStrength);

function playMardroeme(s: GameState, player: PlayerId, row: RowKind): GameState {
  const card = s.players[player].hand.find((c) => c.defId === 'sk_mardroeme');
  if (!card) {
    throw new Error('no mardroeme in hand');
  }
  return applyMove(s, { type: 'PLAY_CARD', player, cardInstanceId: card.instanceId, row });
}

describe('Mardroeme — transforms your Berserkers on the played row (same-row)', () => {
  it('transforms only your Berserkers on that row, in place', () => {
    const base = makeState({
      p1: {
        hand: ['sk_mardroeme', 'nr_ves'],
        rows: { melee: ['sk_berserker'], ranged: ['sk_young_berserker'] },
      },
      p2: { hand: ['nr_ves'], rows: { melee: ['sk_berserker'] } },
      turn: 'p1',
    });
    const berserkerId = base.players.p1.rows.melee.units[0].instanceId;

    const s = playMardroeme(base, 'p1', 'melee');

    expect(defAt(s, 'p1', 'melee')).toBe('sk_vildkaarl'); // your melee Berserker
    expect(s.players.p1.rows.melee.units[0].instanceId).toBe(berserkerId); // same slot
    expect(defAt(s, 'p1', 'ranged')).toBe('sk_young_berserker'); // other row untouched
    expect(defAt(s, 'p2', 'melee')).toBe('sk_berserker'); // opponent untouched
    expect(s.players.p1.graveyard.map((c) => c.defId)).toEqual(['sk_mardroeme']);
  });

  it('a transformed Berserker becomes a Vildkaarl (14)', () => {
    const base = makeState({
      p1: { hand: ['sk_mardroeme', 'nr_ves'], rows: { melee: ['sk_berserker'] } },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    expect(eff(playMardroeme(base, 'p1', 'melee'), 'p1', 'melee')).toEqual([14]);
  });

  it('transformed Young Vildkaarls have Tight Bond', () => {
    const base = makeState({
      p1: {
        hand: ['sk_mardroeme', 'nr_ves'],
        rows: { ranged: ['sk_young_berserker', 'sk_young_berserker'] },
      },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    expect(eff(playMardroeme(base, 'p1', 'ranged'), 'p1', 'ranged')).toEqual([16, 16]); // 8×2 each
  });

  it('fizzles on a row with no Berserkers (still discarded)', () => {
    const base = makeState({
      p1: { hand: ['sk_mardroeme', 'nr_ves'], rows: { melee: ['sk_skald'] } },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    const s = playMardroeme(base, 'p1', 'siege');
    expect(defAt(s, 'p1', 'melee')).toBe('sk_skald');
    expect(s.players.p1.graveyard.map((c) => c.defId)).toEqual(['sk_mardroeme']);
  });

  it('is offered as one play per row, no target', () => {
    const base = makeState({ p1: { hand: ['sk_mardroeme'] }, p2: { hand: ['nr_ves'] }, turn: 'p1' });
    const moves = getLegalMoves(base, 'p1').filter(
      (m): m is Extract<Move, { type: 'PLAY_CARD' }> => m.type === 'PLAY_CARD',
    );
    expect(moves).toHaveLength(3);
    expect(moves.map((m) => m.row).sort()).toEqual(['melee', 'ranged', 'siege']);
    expect(moves.every((m) => m.targetInstanceId === undefined)).toBe(true);
  });
});

describe('Ermion — built-in Mardroeme on his own row', () => {
  it('transforms Berserkers on his (ranged) row when played; other rows untouched', () => {
    const base = makeState({
      p1: {
        hand: ['sk_ermion', 'nr_ves'],
        rows: { ranged: ['sk_young_berserker'], melee: ['sk_berserker'] },
      },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    const s = play(base, 'p1', 'sk_ermion'); // Ermion lands on ranged
    expect(defAt(s, 'p1', 'ranged', 0)).toBe('sk_young_vildkaarl'); // ranged Berserker flipped
    expect(defAt(s, 'p1', 'melee')).toBe('sk_berserker'); // melee untouched (different row)
  });
});

describe('Berserker package — deck building', () => {
  it('the Skellige starter (with Berserkers + Mardroeme) is legal', () => {
    expect(() => validateDeck(SKELLIGE_STARTER)).not.toThrow();
  });

  it('transform-only Vildkaarls cannot be deck-built', () => {
    expect(() => validateDeck({ leaderId: 'sk_crach', cardIds: ['sk_vildkaarl'] })).toThrow();
    expect(() => validateDeck({ leaderId: 'sk_crach', cardIds: ['sk_young_vildkaarl'] })).toThrow();
  });
});
