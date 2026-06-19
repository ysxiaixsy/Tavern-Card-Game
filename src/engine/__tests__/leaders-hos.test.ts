import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { rowUnitViews } from '../strength.ts';
import type { GameState, Move, PlayerId, RowKind } from '../types.ts';
import { boardIds, makeState } from './testkit.ts';

const eff = (s: GameState, side: PlayerId, row: RowKind): number[] =>
  rowUnitViews(s, side, row).map((u) => u.effectiveStrength);
const defsOn = (s: GameState, side: PlayerId, row: RowKind): string[] =>
  s.players[side].rows[row].units.map((u) => u.defId);

describe('Eredin, the Treacherous — passive doubles all spies', () => {
  it('doubles spy units on both sides; heroes (Avallac’h) immune; non-spies untouched', () => {
    const s = makeState({
      p1: {
        leader: 'mon_eredin_treacherous',
        rows: {
          ranged: ['nr_dijkstra'], // spy unit, 4 -> 8
          melee: ['neu_avallach'], // spy HERO, immune -> 0
          siege: ['sk_skald'], // non-spy, 4 -> 4
        },
      },
      p2: { rows: { ranged: ['nr_stennis'] } }, // spy unit on the other side, 5 -> 10
    });
    expect(eff(s, 'p1', 'ranged')).toEqual([8]);
    expect(eff(s, 'p1', 'melee')).toEqual([0]);
    expect(eff(s, 'p1', 'siege')).toEqual([4]);
    expect(eff(s, 'p2', 'ranged')).toEqual([10]);
  });

  it('without Eredin the Treacherous, spies are not doubled', () => {
    const s = makeState({ p1: { rows: { ranged: ['nr_dijkstra'] } } }); // default leaders
    expect(eff(s, 'p1', 'ranged')).toEqual([4]);
  });

  it('Emhyr White Flame (cancel_leader) switches the passive off', () => {
    const base = makeState({
      p1: { leader: 'ng_emhyr_emperor', hand: ['nr_ves'] }, // cancel_leader
      p2: { leader: 'mon_eredin_treacherous', hand: ['nr_ves'], rows: { ranged: ['nr_dijkstra'] } },
      turn: 'p1',
    });
    expect(eff(base, 'p2', 'ranged')).toEqual([8]); // doubled while active
    const move = getLegalMoves(base, 'p1').find((m) => m.type === 'USE_LEADER');
    const s = applyMove(base, move as Move);
    expect(s.players.p2.leaderUsed).toBe(true);
    expect(eff(s, 'p2', 'ranged')).toEqual([4]); // passive cancelled
  });
});

describe('Francesca, Hope of the Aen Seidhe — realign agile units to the best row', () => {
  it('moves all agile units off a weathered row to the stronger one', () => {
    const base = makeState({
      p1: {
        leader: 'st_francesca_hope',
        hand: ['nr_ves'],
        rows: { melee: ['st_dol_scout', 'sk_skald'], ranged: ['st_dol_scout'] },
      },
      p2: { hand: ['nr_ves'] },
      weather: [{ defId: 'neu_frost', owner: 'p2' }], // frost nukes melee
      turn: 'p1',
    });
    const move = getLegalMoves(base, 'p1').find((m) => m.type === 'USE_LEADER');
    expect(move).toBeDefined();
    const s = applyMove(base, move as Move);

    // Both agile Dol Blathanna Scouts end up on ranged; the non-agile skald stays.
    expect(defsOn(s, 'p1', 'melee')).toEqual(['sk_skald']);
    expect(defsOn(s, 'p1', 'ranged').filter((d) => d === 'st_dol_scout')).toHaveLength(2);
    expect(s.players.p1.leaderUsed).toBe(true);
  });

  it('is only offered when an agile unit is on the board', () => {
    const none = makeState({ p1: { leader: 'st_francesca_hope', rows: { melee: ['sk_skald'] } }, turn: 'p1' });
    expect(getLegalMoves(none, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(false);

    const some = makeState({ p1: { leader: 'st_francesca_hope', rows: { ranged: ['st_dol_scout'] } }, turn: 'p1' });
    expect(getLegalMoves(some, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(true);
  });
});

describe('Emhyr, Invader of the North — restore-to-field abilities go random (both players)', () => {
  it('a medic revives a random unit immediately, with no pending choice', () => {
    const base = makeState({
      p1: {
        leader: 'ng_emhyr_invader',
        hand: ['ng_etolian_archers', 'nr_ves'], // a medic + filler
        graveyard: ['ng_arbalest', 'ng_cynthia'], // two non-hero revive targets
      },
      p2: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    const medic = base.players.p1.hand[0];
    const s = applyMove(base, { type: 'PLAY_CARD', player: 'p1', cardInstanceId: medic.instanceId });

    expect(s.pendingChoice).toBeNull(); // never prompts under Emhyr Invader
    expect(boardIds(s, 'p1')).toHaveLength(2); // medic + one revived unit
    expect(s.players.p1.graveyard).toHaveLength(1); // 2 - 1 revived
  });

  it('affects the OTHER player too (the passive is global)', () => {
    const base = makeState({
      p1: { leader: 'ng_emhyr_invader', hand: ['nr_ves'] },
      p2: {
        leader: 'mon_eredin', // ordinary leader
        hand: ['ng_etolian_archers', 'nr_ves'],
        graveyard: ['ng_arbalest', 'ng_cynthia'],
      },
      turn: 'p2',
    });
    const medic = base.players.p2.hand[0];
    const s = applyMove(base, { type: 'PLAY_CARD', player: 'p2', cardInstanceId: medic.instanceId });
    expect(s.pendingChoice).toBeNull();
    expect(boardIds(s, 'p2')).toHaveLength(2);
  });

  it('collapses a play-from-graveyard leader to a single random move', () => {
    const base = makeState({
      p1: { leader: 'ng_emhyr_invader', hand: ['nr_ves'] },
      p2: {
        leader: 'mon_eredin_king', // play_from_graveyard
        hand: ['nr_ves'],
        graveyard: ['ng_arbalest', 'ng_cynthia'],
      },
      turn: 'p2',
    });
    const leaderMoves = getLegalMoves(base, 'p2').filter(
      (m): m is Extract<Move, { type: 'USE_LEADER' }> => m.type === 'USE_LEADER',
    );
    expect(leaderMoves).toHaveLength(1);
    expect(leaderMoves[0].targetInstanceId).toBeUndefined();
  });
});
