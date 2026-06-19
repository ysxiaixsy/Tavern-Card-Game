import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { rowUnitViews } from '../strength.ts';
import type { GameState, Move, PlayerId, RowKind } from '../types.ts';
import { makeState } from './testkit.ts';

const eff = (s: GameState, side: PlayerId, row: RowKind): number[] =>
  rowUnitViews(s, side, row).map((u) => u.effectiveStrength);

describe('Skellige Storm — halves ranged + siege (ceil, min 1), both sides', () => {
  it('halves ranged and siege, leaves melee, heroes immune', () => {
    const s = makeState({
      p1: {
        rows: {
          melee: ['sk_craite_warrior'], // 6, storm misses melee
          ranged: ['sk_skald', 'sk_ermion'], // 4 -> 2 ; hero 8 immune
          siege: ['sk_war_longship'], // 6 -> 3
        },
      },
      p2: { rows: { ranged: ['st_milva'] } }, // 10 -> 5 (storm hits both sides)
      weather: [{ defId: 'sk_storm', owner: 'p2' }],
    });
    expect(eff(s, 'p1', 'melee')).toEqual([6]);
    expect(eff(s, 'p1', 'ranged')).toEqual([2, 8]);
    expect(eff(s, 'p1', 'siege')).toEqual([3]);
    expect(eff(s, 'p2', 'ranged')).toEqual([5]);
  });

  it('rounds up and never drops below 1', () => {
    const s = makeState({
      p1: { rows: { ranged: ['mon_forktail'] } }, // 5 -> ceil(2.5) = 3
      p2: { rows: { ranged: ['mon_wyvern'] } }, // 2 -> 1
      weather: [{ defId: 'sk_storm', owner: 'p1' }],
    });
    expect(eff(s, 'p1', 'ranged')).toEqual([3]);
    expect(eff(s, 'p2', 'ranged')).toEqual([1]);
  });

  it('hard weather still nukes to 1 and wins over storm on a shared row', () => {
    const s = makeState({
      p1: { rows: { ranged: ['mon_forktail'], siege: ['sk_war_longship'] } },
      weather: [
        { defId: 'sk_storm', owner: 'p1' }, // halves ranged + siege
        { defId: 'neu_rain', owner: 'p2' }, // nukes siege to 1 (dominates)
      ],
    });
    expect(eff(s, 'p1', 'ranged')).toEqual([3]); // storm only
    expect(eff(s, 'p1', 'siege')).toEqual([1]); // rain wins
  });
});

describe('King Bran — once tapped, his side only halves weather instead of nuking', () => {
  it('halves frost/fog/rain for his side; opponent still nuked to 1', () => {
    const base = makeState({
      p1: {
        leader: 'sk_bran',
        hand: ['nr_ves'], // keep hands non-empty so the round doesn't resolve
        rows: { melee: ['mon_forktail'] }, // 5 under frost
      },
      p2: { hand: ['nr_ves'], rows: { melee: ['st_milva'] } }, // 10 under frost
      weather: [{ defId: 'neu_frost', owner: 'p2' }],
      turn: 'p1',
    });
    // Before activation, frost nukes both sides to 1.
    expect(eff(base, 'p1', 'melee')).toEqual([1]);

    const move = getLegalMoves(base, 'p1').find((m) => m.type === 'USE_LEADER');
    expect(move).toBeDefined();
    const s = applyMove(base, move as Move);

    expect(s.players.p1.leaderUsed).toBe(true);
    expect(eff(s, 'p1', 'melee')).toEqual([3]); // 5 -> ceil = 3 for Bran's side
    expect(eff(s, 'p2', 'melee')).toEqual([1]); // opponent unchanged
  });

  it('does not double-reduce storm (Bran + storm still just halves)', () => {
    const base = makeState({
      p1: { leader: 'sk_bran', hand: ['nr_ves'], rows: { ranged: ['mon_forktail'] } }, // 5
      p2: { hand: ['nr_ves'] },
      weather: [{ defId: 'sk_storm', owner: 'p2' }],
      turn: 'p1',
    });
    const move = getLegalMoves(base, 'p1').find((m) => m.type === 'USE_LEADER');
    const s = applyMove(base, move as Move);
    expect(eff(s, 'p1', 'ranged')).toEqual([3]); // ceil(5/2), not quartered
  });

  it('is only offered while weather is on the board', () => {
    const dry = makeState({ p1: { leader: 'sk_bran', rows: { ranged: ['mon_forktail'] } }, turn: 'p1' });
    expect(getLegalMoves(dry, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(false);

    const wet = makeState({
      p1: { leader: 'sk_bran', rows: { ranged: ['mon_forktail'] } },
      weather: [{ defId: 'neu_fog', owner: 'p2' }],
      turn: 'p1',
    });
    expect(getLegalMoves(wet, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(true);
  });
});

describe('Skellige Storm — as a played card', () => {
  it('a played storm reduces the opponent ranged/siege and lands in the weather area', () => {
    const base = makeState({
      p1: { hand: ['sk_storm', 'nr_ves'] }, // filler keeps p1's hand non-empty after the play
      p2: { hand: ['nr_ves'], rows: { ranged: ['st_milva'], siege: ['sk_war_longship'] } },
      turn: 'p1',
    });
    const s = applyMove(base, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardInstanceId: base.players.p1.hand[0].instanceId,
    });
    expect(s.weatherCards.map((w) => w.defId)).toEqual(['sk_storm']);
    expect(eff(s, 'p2', 'ranged')).toEqual([5]);
    expect(eff(s, 'p2', 'siege')).toEqual([3]);
  });
});
