import { describe, expect, it } from 'vitest';
import { rowTotal } from '../strength.ts';
import { graveyardDefs, makeState, play } from './testkit.ts';

describe('weather cards', () => {
  it('frost/fog/rain map to melee/ranged/siege', () => {
    const state = makeState({
      p1: {
        hand: ['neu_frost', 'nr_yarpen'], // reserve card keeps the round open
        rows: { melee: ['neu_vesemir'], ranged: ['nr_dethmold'], siege: ['nr_trebuchet'] },
      },
    });
    const afterFrost = play(state, 'p1', 'neu_frost');
    expect(rowTotal(afterFrost, 'p1', 'melee')).toBe(1);
    expect(rowTotal(afterFrost, 'p1', 'ranged')).toBe(6); // untouched
    expect(rowTotal(afterFrost, 'p1', 'siege')).toBe(6); // untouched
  });

  it('a duplicate weather card is legal but adds no effect', () => {
    const state = makeState({
      p1: { hand: ['neu_frost', 'nr_yarpen'], rows: { melee: ['neu_vesemir'] } },
      weather: [{ defId: 'neu_frost', owner: 'p2' }],
    });
    const after = play(state, 'p1', 'neu_frost');
    expect(rowTotal(after, 'p1', 'melee')).toBe(1);
    expect(after.weatherCards).toHaveLength(2); // both sit in the weather area
  });

  it('clear weather removes all weather; cards return to their OWNERS\' graveyards', () => {
    const state = makeState({
      p1: { hand: ['neu_clear'] },
      turn: 'p1',
      weather: [
        { defId: 'neu_frost', owner: 'p1' },
        { defId: 'neu_rain', owner: 'p2' },
      ],
    });
    const after = play(state, 'p1', 'neu_clear');
    expect(after.weatherCards).toHaveLength(0);
    expect(graveyardDefs(after, 'p1')).toEqual(['neu_clear', 'neu_frost']);
    expect(graveyardDefs(after, 'p2')).toEqual(['neu_rain']);
  });

  it('weather clears between rounds and cards reach their owners\' graveyards', () => {
    const state = makeState({
      p1: { hand: ['neu_vesemir'], passed: true },
      p2: { hand: ['mon_fiend'] },
      turn: 'p2',
      weather: [{ defId: 'neu_frost', owner: 'p2' }],
    });
    const after = play(state, 'p2', 'mon_fiend'); // p2 empties hand → forced pass → round resolves
    expect(after.round).toBe(2);
    expect(after.weatherCards).toHaveLength(0);
    expect(graveyardDefs(after, 'p2')).toContain('neu_frost');
  });
});
