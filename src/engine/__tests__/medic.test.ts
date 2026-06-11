import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { GwentError } from '../types.ts';
import { makeState, play } from './testkit.ts';

describe('Medic', () => {
  it('named scenario: medic → revives medic → revives spy → both spy draws fire', () => {
    const state = makeState({
      p1: {
        hand: ['nr_dun_banner_medic', 'nr_ves'],
        deck: ['nr_yarpen', 'nr_sile', 'nr_keira'],
        graveyard: ['nr_dun_banner_medic', 'nr_stennis'],
      },
      p2: { hand: ['mon_fiend'] },
    });
    const buriedMedic = state.players.p1.graveyard[0];
    const buriedSpy = state.players.p1.graveyard[1];

    // Play medic #1 → the game suspends in a pendingChoice owned by p1.
    let s = play(state, 'p1', 'nr_dun_banner_medic');
    expect(s.pendingChoice).toEqual({
      kind: 'medic_revive',
      player: 'p1',
      medicInstanceId: s.players.p1.rows.siege.units[0].instanceId,
    });
    expect(s.turn).toBe('p1'); // turn does NOT pass mid-chain
    expect(getLegalMoves(s, 'p2')).toEqual([]); // opponent is locked out
    // Only RESOLVE_MEDIC moves are offered, and PLAY_CARD is rejected.
    expect(getLegalMoves(s, 'p1').every((m) => m.type === 'RESOLVE_MEDIC')).toBe(true);
    expect(() => play(s, 'p1', 'nr_ves')).toThrowError(GwentError);

    // Resolve link 1: revive the buried medic → chain continues.
    s = applyMove(s, {
      type: 'RESOLVE_MEDIC',
      player: 'p1',
      targetInstanceId: buriedMedic.instanceId,
    });
    expect(s.pendingChoice?.kind).toBe('medic_revive');

    // Resolve link 2: revive the spy → it lands on p2's side, p1 draws 2.
    s = applyMove(s, {
      type: 'RESOLVE_MEDIC',
      player: 'p1',
      targetInstanceId: buriedSpy.instanceId,
    });
    expect(s.pendingChoice).toBeNull();
    expect(s.players.p2.rows.melee.units.map((u) => u.defId)).toEqual(['nr_stennis']);
    expect(s.players.p1.hand.map((c) => c.defId).sort()).toEqual(['nr_sile', 'nr_ves', 'nr_yarpen']);
    expect(s.players.p1.deck.map((c) => c.defId)).toEqual(['nr_keira']);
    expect(s.players.p1.graveyard).toHaveLength(0);
    expect(s.turn).toBe('p2'); // chain exhausted → turn finally passes
  });

  it('with an empty graveyard the medic plays as a plain unit (auto-skip)', () => {
    const state = makeState({
      p1: { hand: ['nr_dun_banner_medic'] },
      p2: { hand: ['mon_fiend'] },
    });
    const after = play(state, 'p1', 'nr_dun_banner_medic');
    expect(after.pendingChoice).toBeNull();
    expect(after.turn).toBe('p2');
  });

  it('cannot revive heroes or special cards', () => {
    const state = makeState({
      p1: {
        hand: ['nr_dun_banner_medic'],
        graveyard: ['neu_geralt', 'neu_scorch', 'nr_ves'],
      },
      p2: { hand: ['mon_fiend'] },
    });
    const [hero, scorch] = state.players.p1.graveyard;
    const s = play(state, 'p1', 'nr_dun_banner_medic');

    // Only the plain unit is offered.
    const offered = getLegalMoves(s, 'p1');
    expect(offered).toHaveLength(1);
    expect(offered[0]).toMatchObject({ type: 'RESOLVE_MEDIC' });

    for (const illegal of [hero, scorch]) {
      expect(() =>
        applyMove(s, { type: 'RESOLVE_MEDIC', player: 'p1', targetInstanceId: illegal.instanceId }),
      ).toThrowError(GwentError);
    }
  });

  it('revives only from your OWN graveyard', () => {
    const state = makeState({
      p1: { hand: ['nr_dun_banner_medic'], graveyard: ['nr_ves'] },
      p2: { graveyard: ['mon_fiend'] },
    });
    const enemyDead = state.players.p2.graveyard[0];
    const s = play(state, 'p1', 'nr_dun_banner_medic');
    expect(() =>
      applyMove(s, { type: 'RESOLVE_MEDIC', player: 'p1', targetInstanceId: enemyDead.instanceId }),
    ).toThrowError(GwentError);
  });

  it('a revived muster unit musters (full effects on revival)', () => {
    const state = makeState({
      p1: {
        hand: ['nr_dun_banner_medic'],
        deck: ['mon_nekker'],
        graveyard: ['mon_nekker'],
      },
      p2: { hand: ['mon_fiend'] },
    });
    const buried = state.players.p1.graveyard[0];
    let s = play(state, 'p1', 'nr_dun_banner_medic');
    s = applyMove(s, { type: 'RESOLVE_MEDIC', player: 'p1', targetInstanceId: buried.instanceId });
    // The revived nekker pulled its deck copy along.
    expect(s.players.p1.rows.melee.units.map((u) => u.defId)).toEqual([
      'mon_nekker',
      'mon_nekker',
    ]);
    expect(s.players.p1.deck).toHaveLength(0);
  });

  it('hero medics (Yennefer) still trigger the revive choice', () => {
    const state = makeState({
      p1: { hand: ['neu_yennefer'], graveyard: ['nr_ves'] },
      p2: { hand: ['mon_fiend'] },
    });
    const s = play(state, 'p1', 'neu_yennefer');
    expect(s.pendingChoice?.kind).toBe('medic_revive');
  });

  it('an agile revive target requires a row choice', () => {
    const state = makeState({
      p1: { hand: ['nr_dun_banner_medic'], graveyard: ['mon_celaeno_harpy'] },
      p2: { hand: ['mon_fiend'] },
    });
    const harpy = state.players.p1.graveyard[0];
    const s = play(state, 'p1', 'nr_dun_banner_medic');
    const moves = getLegalMoves(s, 'p1');
    expect(moves).toHaveLength(2); // melee or ranged
    const after = applyMove(s, {
      type: 'RESOLVE_MEDIC',
      player: 'p1',
      targetInstanceId: harpy.instanceId,
      row: 'ranged',
    });
    expect(after.players.p1.rows.ranged.units.map((u) => u.defId)).toEqual(['mon_celaeno_harpy']);
  });
});
