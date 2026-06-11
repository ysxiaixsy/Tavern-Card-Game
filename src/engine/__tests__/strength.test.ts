import { describe, expect, it } from 'vitest';
import { rowTotal, rowUnitViews, sideTotal } from '../strength.ts';
import { inst, makeState } from './testkit.ts';

describe('strength calculation order', () => {
  it('worked example: weather → bond ×3 → moral +1 → horn ×2 ⇒ 8 each', () => {
    // Siege row under Torrential Rain: three bonded Catapults (printed 8),
    // one Kaedweni Siege Expert (moral boost) and a Commander's Horn.
    // Each catapult: 8 → rain 1 → ×3 bond = 3 → +1 moral = 4 → ×2 horn = 8.
    const state = makeState({
      p1: { rows: { siege: ['nr_catapult', 'nr_catapult', 'nr_catapult', 'nr_kaedweni'] } },
      weather: [{ defId: 'neu_rain', owner: 'p2' }],
    });
    state.players.p1.rows.siege.horn = inst('neu_horn');

    const views = rowUnitViews(state, 'p1', 'siege');
    expect(views.slice(0, 3).map((u) => u.effectiveStrength)).toEqual([8, 8, 8]);
    // The moral-boost unit doesn't buff itself: 8 → 1 (rain) → +0 → ×2 = 2.
    expect(views[3].effectiveStrength).toBe(2);
    expect(rowTotal(state, 'p1', 'siege')).toBe(26);
  });

  it('weather floors non-heroes to 1', () => {
    const state = makeState({
      p1: { rows: { melee: ['neu_vesemir'] } }, // printed 6
      weather: [{ defId: 'neu_frost', owner: 'p1' }],
    });
    expect(rowUnitViews(state, 'p1', 'melee')[0].effectiveStrength).toBe(1);
  });

  it('weather hits the matching rows of BOTH players', () => {
    const state = makeState({
      p1: { rows: { ranged: ['nr_dethmold'] } }, // 6
      p2: { rows: { ranged: ['mon_forktail'] } }, // 5
      weather: [{ defId: 'neu_fog', owner: 'p1' }],
    });
    expect(rowTotal(state, 'p1', 'ranged')).toBe(1);
    expect(rowTotal(state, 'p2', 'ranged')).toBe(1);
  });

  it('tight bond multiplies by the count of same-named bond units in the row', () => {
    const state = makeState({
      p1: { rows: { melee: ['nr_blue_stripes', 'nr_blue_stripes'] } }, // printed 4
    });
    expect(rowUnitViews(state, 'p1', 'melee').map((u) => u.effectiveStrength)).toEqual([8, 8]);
  });

  it('bond only counts units in the SAME row and with the SAME name', () => {
    const state = makeState({
      p1: {
        rows: {
          melee: ['nr_blue_stripes', 'nr_poor_infantry'], // different bond units
          ranged: [],
        },
      },
    });
    const views = rowUnitViews(state, 'p1', 'melee');
    expect(views[0].effectiveStrength).toBe(4); // ×1
    expect(views[1].effectiveStrength).toBe(1); // ×1
  });

  it('moral boost: +1 from each OTHER moral unit; two experts buff each other', () => {
    const state = makeState({
      p1: { rows: { siege: ['nr_kaedweni', 'nr_kaedweni', 'nr_trebuchet'] } },
    });
    const views = rowUnitViews(state, 'p1', 'siege');
    expect(views[0].effectiveStrength).toBe(2); // 1 + 1 (other expert)
    expect(views[1].effectiveStrength).toBe(2);
    expect(views[2].effectiveStrength).toBe(8); // 6 + 2 moral
  });

  it('horn doubles at most once per row (horn card + Dandelion do not stack)', () => {
    const state = makeState({
      p1: { rows: { melee: ['neu_vesemir', 'neu_dandelion'] } },
    });
    state.players.p1.rows.melee.horn = inst('neu_horn');
    const views = rowUnitViews(state, 'p1', 'melee');
    expect(views[0].effectiveStrength).toBe(12); // 6 × 2, NOT × 4
    // Judgment call: a horn-ability unit is doubled by its own horn.
    expect(views[1].effectiveStrength).toBe(4);
  });

  it('heroes are immune to weather, bond, moral and horn', () => {
    const state = makeState({
      p1: { rows: { melee: ['neu_geralt', 'nr_kaedweni'] } }, // kaedweni is siege-printed but crafted here to prove moral can't touch heroes
      weather: [{ defId: 'neu_frost', owner: 'p2' }],
    });
    state.players.p1.rows.melee.horn = inst('neu_horn');
    const geralt = rowUnitViews(state, 'p1', 'melee')[0];
    expect(geralt.effectiveStrength).toBe(15); // untouched by frost/horn/moral
  });

  it('a spy strengthens the side it sits on', () => {
    const state = makeState({
      p2: { rows: { melee: ['nr_stennis'] } }, // p1's spy sitting on p2's side
    });
    expect(sideTotal(state, 'p2')).toBe(5);
    expect(sideTotal(state, 'p1')).toBe(0);
  });

  it('a decoy on the board is always worth 0', () => {
    const state = makeState({ p1: { rows: { melee: ['neu_decoy', 'neu_vesemir'] } } });
    state.players.p1.rows.melee.horn = inst('neu_horn');
    const views = rowUnitViews(state, 'p1', 'melee');
    expect(views[0].effectiveStrength).toBe(0);
    expect(views[1].effectiveStrength).toBe(12);
  });
});
