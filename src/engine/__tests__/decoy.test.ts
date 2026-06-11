import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { GwentError } from '../types.ts';
import { handCard, makeState, play } from './testkit.ts';

describe('Decoy', () => {
  it('swaps with an own unit: unit to hand, decoy takes its exact spot at 0', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy'], rows: { melee: ['neu_vesemir', 'neu_zoltan'] } },
    });
    const vesemir = state.players.p1.rows.melee.units[0];
    const after = play(state, 'p1', 'neu_decoy', { targetInstanceId: vesemir.instanceId });

    expect(after.players.p1.rows.melee.units.map((u) => u.defId)).toEqual([
      'neu_decoy',
      'neu_zoltan',
    ]);
    expect(after.players.p1.hand.map((c) => c.defId)).toEqual(['neu_vesemir']);
  });

  it('named scenario: steal an enemy spy from your side, replay it, draw 2', () => {
    // p2 played Prince Stennis onto p1's melee row earlier; it strengthens p1's side
    // but is a juicy decoy target.
    const state = makeState({
      p1: {
        hand: ['neu_decoy'],
        deck: ['nr_ves', 'nr_yarpen', 'nr_sile'],
        rows: { melee: ['nr_stennis'] },
      },
      p2: { hand: ['mon_fiend'] },
    });
    const stennis = state.players.p1.rows.melee.units[0];

    // 1. Decoy picks the enemy spy up — it is now p1's card.
    let s = play(state, 'p1', 'neu_decoy', { targetInstanceId: stennis.instanceId });
    expect(s.players.p1.hand.map((c) => c.defId)).toEqual(['nr_stennis']);
    expect(s.players.p1.rows.melee.units.map((u) => u.defId)).toEqual(['neu_decoy']);

    // 2. p2 acts; then p1 replays the stolen spy as their own.
    s = play(s, 'p2', 'mon_fiend');
    s = play(s, 'p1', 'nr_stennis');

    // The spy lands back on the OPPONENT's melee row and p1 draws 2.
    expect(s.players.p2.rows.melee.units.map((u) => u.defId)).toContain('nr_stennis');
    expect(s.players.p1.hand.map((c) => c.defId).sort()).toEqual(['nr_ves', 'nr_yarpen']);
    expect(s.players.p1.deck).toHaveLength(1);
  });

  it('cannot target heroes', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy'], rows: { melee: ['neu_geralt'] } },
    });
    const geralt = state.players.p1.rows.melee.units[0];
    expect(() =>
      play(state, 'p1', 'neu_decoy', { targetInstanceId: geralt.instanceId }),
    ).toThrowError(GwentError);
  });

  it('cannot target another decoy', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy'], rows: { melee: ['neu_decoy'] } },
    });
    const boardDecoy = state.players.p1.rows.melee.units[0];
    expect(() =>
      play(state, 'p1', 'neu_decoy', { targetInstanceId: boardDecoy.instanceId }),
    ).toThrowError(GwentError);
  });

  it('cannot target units on the opponent side of the board', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy'] },
      p2: { rows: { melee: ['mon_fiend'] } },
    });
    const fiend = state.players.p2.rows.melee.units[0];
    expect(() =>
      play(state, 'p1', 'neu_decoy', { targetInstanceId: fiend.instanceId }),
    ).toThrowError(GwentError);
  });

  it('generates no legal moves when you have no valid targets', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy'], rows: { melee: ['neu_geralt'] } }, // hero only
    });
    const decoy = handCard(state, 'p1', 'neu_decoy');
    const decoyMoves = getLegalMoves(state, 'p1').filter(
      (m) => m.type === 'PLAY_CARD' && m.cardInstanceId === decoy.instanceId,
    );
    expect(decoyMoves).toHaveLength(0);
    // And the engine rejects a forced attempt without a target.
    expect(() =>
      applyMove(state, {
        type: 'PLAY_CARD',
        player: 'p1',
        cardInstanceId: decoy.instanceId,
      }),
    ).toThrowError(GwentError);
  });

  it('an agile unit returned by decoy picks its row again on replay', () => {
    const state = makeState({
      p1: { hand: ['neu_decoy', 'nr_yarpen'], rows: { ranged: ['mon_celaeno_harpy'] } },
      p2: { hand: ['mon_fiend'] },
    });
    const harpy = state.players.p1.rows.ranged.units[0];
    let s = play(state, 'p1', 'neu_decoy', { targetInstanceId: harpy.instanceId });
    s = play(s, 'p2', 'mon_fiend');
    s = play(s, 'p1', 'mon_celaeno_harpy', { row: 'melee' }); // different row this time
    expect(s.players.p1.rows.melee.units.map((u) => u.defId)).toEqual(['mon_celaeno_harpy']);
  });
});
