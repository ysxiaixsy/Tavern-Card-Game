import { describe, expect, it } from 'vitest';
import { boardIds, graveyardDefs, makeState, play } from './testkit.ts';

describe('Scorch (special card)', () => {
  it('kills ALL non-hero units tied for highest strength across both sides; heroes untouched', () => {
    const state = makeState({
      p1: {
        hand: ['neu_scorch', 'nr_yarpen'],
        rows: { melee: ['neu_vesemir'], siege: [] }, // Vesemir 6
      },
      p2: {
        rows: { melee: ['mon_fiend', 'mon_draug'], siege: ['mon_earth_elemental'] }, // 6, hero 10, 6
      },
    });
    const after = play(state, 'p1', 'neu_scorch');

    // All three 6-strength units die together, on both sides of the board.
    expect(boardIds(after, 'p1')).toHaveLength(0);
    expect(after.players.p2.rows.melee.units.map((u) => u.defId)).toEqual(['mon_draug']);
    expect(after.players.p2.rows.siege.units).toHaveLength(0);
    expect(graveyardDefs(after, 'p1')).toEqual(['neu_scorch', 'neu_vesemir']);
    expect(graveyardDefs(after, 'p2')).toEqual(['mon_earth_elemental', 'mon_fiend']);
  });

  it('targets EFFECTIVE strength (weather/horn included)', () => {
    const state = makeState({
      p1: { hand: ['neu_scorch', 'nr_yarpen'], rows: { siege: ['nr_trebuchet'] } }, // 6
      p2: { rows: { melee: ['mon_fiend'] } }, // printed 6 but frost-floored to 1
      weather: [{ defId: 'neu_frost', owner: 'p2' }],
    });
    const after = play(state, 'p1', 'neu_scorch');
    expect(graveyardDefs(after, 'p1')).toEqual(['neu_scorch', 'nr_trebuchet']);
    expect(after.players.p2.rows.melee.units).toHaveLength(1); // the frosted fiend survives
  });

  it('with only heroes on the board it fizzles (and still goes to the graveyard)', () => {
    const state = makeState({
      p1: { hand: ['neu_scorch', 'nr_yarpen'] },
      p2: { rows: { melee: ['neu_geralt'] } },
    });
    const after = play(state, 'p1', 'neu_scorch');
    expect(after.players.p2.rows.melee.units).toHaveLength(1);
    expect(graveyardDefs(after, 'p1')).toEqual(['neu_scorch']);
  });
});

describe('Villentretenmerth (unit scorch)', () => {
  it('destroys the strongest non-hero unit(s) in the opponent melee row when it totals >= 10', () => {
    const state = makeState({
      p1: { hand: ['neu_villentretenmerth', 'nr_yarpen'] },
      p2: { rows: { melee: ['mon_fiend', 'mon_werewolf', 'mon_fiend'] } }, // 6+5+6 = 17
    });
    const after = play(state, 'p1', 'neu_villentretenmerth');
    // Both tied 6-strength fiends die; Villentretenmerth stays on p1's melee.
    expect(after.players.p2.rows.melee.units.map((u) => u.defId)).toEqual(['mon_werewolf']);
    expect(graveyardDefs(after, 'p2')).toEqual(['mon_fiend', 'mon_fiend']);
    expect(after.players.p1.rows.melee.units.map((u) => u.defId)).toEqual([
      'neu_villentretenmerth',
    ]);
  });

  it('does nothing when the opponent melee row totals less than 10', () => {
    const state = makeState({
      p1: { hand: ['neu_villentretenmerth', 'nr_yarpen'] },
      p2: { rows: { melee: ['mon_werewolf'] } }, // 5 < 10
    });
    const after = play(state, 'p1', 'neu_villentretenmerth');
    expect(after.players.p2.rows.melee.units).toHaveLength(1);
    expect(after.players.p2.graveyard).toHaveLength(0);
  });

  it('heroes count toward the 10 threshold but can never be destroyed', () => {
    const state = makeState({
      p1: { hand: ['neu_villentretenmerth', 'nr_yarpen'] },
      p2: { rows: { melee: ['mon_draug', 'mon_nekker'] } }, // hero 10 + 2 = 12 >= 10
    });
    const after = play(state, 'p1', 'neu_villentretenmerth');
    expect(after.players.p2.rows.melee.units.map((u) => u.defId)).toEqual(['mon_draug']);
    expect(graveyardDefs(after, 'p2')).toEqual(['mon_nekker']);
  });

  it('only hits the melee row, not ranged or siege', () => {
    const state = makeState({
      p1: { hand: ['neu_villentretenmerth', 'nr_yarpen'] },
      p2: { rows: { melee: ['mon_fiend', 'mon_fiend'], ranged: ['mon_forktail'] } }, // melee 12
    });
    const after = play(state, 'p1', 'neu_villentretenmerth');
    expect(after.players.p2.rows.ranged.units).toHaveLength(1); // forktail untouched
    expect(after.players.p2.rows.melee.units).toHaveLength(0);
  });
});
