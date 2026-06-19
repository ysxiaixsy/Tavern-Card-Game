import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { validateDeck } from '../game.ts';
import { SKELLIGE_STARTER } from '../data/decks.ts';
import { rowUnitViews } from '../strength.ts';
import type { GameState, Move, PlayerId, RowKind } from '../types.ts';
import { makeState } from './testkit.ts';

const defAt = (s: GameState, side: PlayerId, row: RowKind, i = 0): string =>
  s.players[side].rows[row].units[i].defId;
const eff = (s: GameState, side: PlayerId, row: RowKind): number[] =>
  rowUnitViews(s, side, row).map((u) => u.effectiveStrength);

function playMardroeme(s: GameState, player: PlayerId): GameState {
  const card = s.players[player].hand.find((c) => c.defId === 'sk_mardroeme');
  if (!card) {
    throw new Error('no mardroeme in hand');
  }
  return applyMove(s, { type: 'PLAY_CARD', player, cardInstanceId: card.instanceId });
}

describe('Mardroeme — transforms Berserkers into Vildkaarls on both sides', () => {
  it('flips Berserker→Vildkaarl and Young Berserker→Young Vildkaarl, in place', () => {
    const base = makeState({
      p1: {
        hand: ['sk_mardroeme', 'nr_ves'],
        rows: { melee: ['sk_berserker'], ranged: ['sk_young_berserker'] },
      },
      p2: {
        hand: ['nr_ves'],
        rows: { melee: ['sk_berserker'], ranged: ['sk_skald'] }, // skald = non-berserker
      },
      turn: 'p1',
    });
    const berserkerId = base.players.p1.rows.melee.units[0].instanceId;

    const s = playMardroeme(base, 'p1');

    // p1: both berserkers transformed, same slots.
    expect(defAt(s, 'p1', 'melee')).toBe('sk_vildkaarl');
    expect(defAt(s, 'p1', 'ranged')).toBe('sk_young_vildkaarl');
    expect(s.players.p1.rows.melee.units[0].instanceId).toBe(berserkerId); // instanceId kept
    // p2: berserker transformed too (both sides); the skald is untouched.
    expect(defAt(s, 'p2', 'melee')).toBe('sk_vildkaarl');
    expect(defAt(s, 'p2', 'ranged')).toBe('sk_skald');
    // Mardroeme spent into the graveyard.
    expect(s.players.p1.graveyard.map((c) => c.defId)).toEqual(['sk_mardroeme']);
  });

  it('applies the Vildkaarl forms strengths/abilities', () => {
    const base = makeState({
      p1: {
        hand: ['sk_mardroeme', 'nr_ves'],
        rows: { melee: ['sk_berserker'], ranged: ['sk_young_berserker', 'sk_young_berserker'] },
      },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    const s = playMardroeme(base, 'p1');
    expect(eff(s, 'p1', 'melee')).toEqual([14]); // Vildkaarl 14 (alone: morale +0)
    // Two Young Vildkaarls (Tight Bond) on the same row: 8×2 each.
    expect(eff(s, 'p1', 'ranged')).toEqual([16, 16]);
  });

  it('with no Berserkers out it simply fizzles (still discarded)', () => {
    const base = makeState({
      p1: { hand: ['sk_mardroeme', 'nr_ves'], rows: { melee: ['sk_skald'] } },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    const s = playMardroeme(base, 'p1');
    expect(defAt(s, 'p1', 'melee')).toBe('sk_skald');
    expect(s.players.p1.graveyard.map((c) => c.defId)).toEqual(['sk_mardroeme']);
  });

  it('is offered as a play with no row or target', () => {
    const base = makeState({ p1: { hand: ['sk_mardroeme'] }, p2: { hand: ['nr_ves'] }, turn: 'p1' });
    const moves = getLegalMoves(base, 'p1').filter(
      (m): m is Extract<Move, { type: 'PLAY_CARD' }> => m.type === 'PLAY_CARD',
    );
    expect(moves).toHaveLength(1);
    expect(moves[0].row).toBeUndefined();
    expect(moves[0].targetInstanceId).toBeUndefined();
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
