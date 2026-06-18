import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { rowTotal } from '../strength.ts';
import type { Move } from '../types.ts';
import { graveyardDefs, makeState, play } from './testkit.ts';

describe('Hearts of Stone — Gaunter O\'Dimm muster (one-directional)', () => {
  it('Gaunter O\'Dimm summons every Darkness from hand AND deck', () => {
    const state = makeState({
      p1: {
        hand: ['neu_godimm', 'neu_godimm_darkness'],
        deck: ['neu_godimm_darkness', 'neu_godimm_darkness'],
      },
      p2: { hand: ['mon_fiend'] }, // keeps the round open
    });
    const after = play(state, 'p1', 'neu_godimm');
    expect(after.players.p1.rows.siege.units.map((u) => u.defId)).toEqual(['neu_godimm']);
    expect(
      after.players.p1.rows.ranged.units.filter((u) => u.defId === 'neu_godimm_darkness'),
    ).toHaveLength(3);
    expect(after.players.p1.hand).toHaveLength(0);
    expect(after.players.p1.deck).toHaveLength(0);
  });

  it('a Darkness summons only OTHER Darkness — Gaunter is never pulled', () => {
    const state = makeState({
      p1: { hand: ['neu_godimm_darkness', 'neu_godimm'], deck: ['neu_godimm_darkness'] },
      p2: { hand: ['mon_fiend'] },
    });
    const after = play(state, 'p1', 'neu_godimm_darkness');
    expect(after.players.p1.rows.ranged.units.map((u) => u.defId)).toEqual([
      'neu_godimm_darkness',
      'neu_godimm_darkness',
    ]);
    expect(after.players.p1.hand.map((c) => c.defId)).toEqual(['neu_godimm']); // Gaunter stays
    expect(after.players.p1.deck).toHaveLength(0);
  });
});

describe('Hearts of Stone — unit scorch on non-melee rows', () => {
  it('Toad scorches the opponent RANGED row at 10+', () => {
    const state = makeState({
      p1: { hand: ['mon_toad', 'nr_yarpen'] },
      p2: { hand: ['mon_ghoul'], rows: { ranged: ['mon_forktail', 'mon_forktail'] } }, // 5+5 = 10
    });
    const after = play(state, 'p1', 'mon_toad');
    expect(after.players.p2.rows.ranged.units).toHaveLength(0); // both tied 5s burn
    expect(graveyardDefs(after, 'p2')).toEqual(['mon_forktail', 'mon_forktail']);
  });

  it('Schirrú scorches the opponent SIEGE row at 10+', () => {
    const state = makeState({
      p1: { hand: ['st_schirru', 'nr_yarpen'] },
      p2: { hand: ['mon_ghoul'], rows: { siege: ['mon_earth_elemental', 'mon_ice_giant'] } }, // 6 + 5
    });
    const after = play(state, 'p1', 'st_schirru');
    expect(after.players.p2.rows.siege.units.map((u) => u.defId)).toEqual(['mon_ice_giant']);
    expect(graveyardDefs(after, 'p2')).toEqual(['mon_earth_elemental']);
  });

  it('Villentretenmerth still scorches MELEE (generalized ability unchanged)', () => {
    const state = makeState({
      p1: { hand: ['neu_villentretenmerth', 'nr_yarpen'] },
      p2: { hand: ['mon_ghoul'], rows: { melee: ['mon_fiend', 'mon_fiend'] } }, // 6+6 = 12
    });
    const after = play(state, 'p1', 'neu_villentretenmerth');
    expect(after.players.p2.rows.melee.units).toHaveLength(0);
  });
});

describe('Hearts of Stone — Olgierd (agile + morale)', () => {
  it('is agile (row choice) and boosts the rest of its row', () => {
    const state = makeState({
      p1: { hand: ['neu_olgierd'], rows: { ranged: ['nr_keira'] } },
      p2: { hand: ['mon_fiend'] },
    });
    const after = play(state, 'p1', 'neu_olgierd', { row: 'ranged' });
    // Keira 5 + 1 (Olgierd morale) = 6; Olgierd 6 (no self-morale) → row 12.
    expect(rowTotal(after, 'p1', 'ranged')).toBe(12);
    expect(after.players.p1.rows.melee.units).toHaveLength(0); // chose ranged, not melee
  });
});

describe('Hearts of Stone — Foltest, Son of Medell (leader scorch ranged)', () => {
  it('burns the strongest enemy ranged unit(s) when that row totals 10+', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest_medell', hand: ['nr_ves'] },
      p2: { hand: ['mon_ghoul'], rows: { ranged: ['mon_forktail', 'mon_forktail'] } }, // 10
    });
    const move = getLegalMoves(state, 'p1').find((m) => m.type === 'USE_LEADER');
    expect(move).toBeDefined();
    const after = applyMove(state, move as Move);
    expect(after.players.p2.rows.ranged.units).toHaveLength(0);
    expect(after.players.p1.leaderUsed).toBe(true);
  });
});
