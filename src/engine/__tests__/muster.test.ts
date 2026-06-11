import { describe, expect, it } from 'vitest';
import { makeState, play } from './testkit.ts';

describe('Muster', () => {
  it('named scenario: pulls copies from hand AND deck', () => {
    const state = makeState({
      p1: {
        hand: ['mon_nekker', 'mon_nekker', 'nr_ves'],
        deck: ['mon_nekker', 'nr_yarpen'],
      },
    });
    const after = play(state, 'p1', 'mon_nekker');

    expect(after.players.p1.rows.melee.units.map((u) => u.defId)).toEqual([
      'mon_nekker',
      'mon_nekker',
      'mon_nekker',
    ]);
    expect(after.players.p1.hand.map((c) => c.defId)).toEqual(['nr_ves']); // unrelated card stays
    expect(after.players.p1.deck.map((c) => c.defId)).toEqual(['nr_yarpen']);
  });

  it('the Crones muster as one group despite different names', () => {
    const state = makeState({
      p1: {
        hand: ['mon_crone_brewess', 'mon_crone_weavess', 'nr_yarpen'],
        deck: ['mon_crone_whispess'],
      },
    });
    const after = play(state, 'p1', 'mon_crone_brewess');
    expect(after.players.p1.rows.melee.units.map((u) => u.defId).sort()).toEqual([
      'mon_crone_brewess',
      'mon_crone_weavess',
      'mon_crone_whispess',
    ]);
  });

  it('does NOT pull copies from the graveyard', () => {
    const state = makeState({
      p1: { hand: ['mon_ghoul', 'nr_yarpen'], graveyard: ['mon_ghoul'] },
    });
    const after = play(state, 'p1', 'mon_ghoul');
    expect(after.players.p1.rows.melee.units).toHaveLength(1);
    expect(after.players.p1.graveyard).toHaveLength(1);
  });

  it('different muster groups stay independent', () => {
    const state = makeState({
      p1: { hand: ['mon_nekker', 'nr_yarpen'], deck: ['mon_ghoul', 'mon_arachas'] },
    });
    const after = play(state, 'p1', 'mon_nekker');
    expect(after.players.p1.rows.melee.units.map((u) => u.defId)).toEqual(['mon_nekker']);
    expect(after.players.p1.deck).toHaveLength(2);
  });
});

describe('Spy', () => {
  it('lands on the opponent\'s matching row and draws 2 from your deck', () => {
    const state = makeState({
      p1: { hand: ['nr_thaler'], deck: ['nr_ves', 'nr_yarpen', 'nr_sile'] },
    });
    const after = play(state, 'p1', 'nr_thaler');

    expect(after.players.p2.rows.siege.units.map((u) => u.defId)).toEqual(['nr_thaler']);
    expect(after.players.p1.rows.siege.units).toHaveLength(0);
    expect(after.players.p1.hand.map((c) => c.defId).sort()).toEqual(['nr_ves', 'nr_yarpen']);
    expect(after.players.p1.deck).toHaveLength(1);
  });

  it('draws as many as remain when the deck has fewer than 2', () => {
    const one = makeState({ p1: { hand: ['nr_stennis'], deck: ['nr_ves'] } });
    const afterOne = play(one, 'p1', 'nr_stennis');
    expect(afterOne.players.p1.hand.map((c) => c.defId)).toEqual(['nr_ves']);

    const empty = makeState({ p1: { hand: ['nr_stennis', 'nr_yarpen'] } });
    const afterEmpty = play(empty, 'p1', 'nr_stennis');
    expect(afterEmpty.players.p1.hand.map((c) => c.defId)).toEqual(['nr_yarpen']);
  });

  it('hero spies (Avallac\'h) go to the opponent side, draw 2 and stay hero-immune', () => {
    const state = makeState({
      p1: { hand: ['neu_avallach'], deck: ['nr_ves', 'nr_yarpen'] },
      p2: { hand: ['neu_decoy'] },
    });
    let s = play(state, 'p1', 'neu_avallach');
    expect(s.players.p2.rows.melee.units.map((u) => u.defId)).toEqual(['neu_avallach']);
    expect(s.players.p1.hand).toHaveLength(2);

    // p2 cannot decoy the hero spy off their side.
    const avallach = s.players.p2.rows.melee.units[0];
    expect(() =>
      play(s, 'p2', 'neu_decoy', { targetInstanceId: avallach.instanceId }),
    ).toThrow();
  });
});
