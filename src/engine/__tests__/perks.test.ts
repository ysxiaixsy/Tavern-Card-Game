import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { GwentError } from '../types.ts';
import { boardIds, makeState, pass } from './testkit.ts';

describe('faction perks', () => {
  it('Northern Realms draws 1 card on every round win', () => {
    const state = makeState({
      p1: { deck: ['nr_ves', 'nr_yarpen'], hand: ['nr_keira'], rows: { melee: ['neu_vesemir'] } },
      p2: { hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // p1 wins 6:0
    expect(s.round).toBe(2);
    expect(s.roundHistory[0].winner).toBe('p1');
    // Hand: keira (kept) + 1 perk draw.
    expect(s.players.p1.hand).toHaveLength(2);
    expect(s.players.p1.deck).toHaveLength(1);
    // Loser (Monsters) draws nothing.
    expect(s.players.p2.hand).toHaveLength(1);
  });

  it('named scenario: Nilfgaard wins a 0–0 tie', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr' }, // faction nilfgaard
      p2: { hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // 0:0
    expect(s.roundHistory[0]).toMatchObject({
      totals: { p1: 0, p2: 0 },
      winner: 'p1',
      tieBrokenByNilfgaard: true,
    });
    expect(s.players.p1.gems).toBe(2);
    expect(s.players.p2.gems).toBe(1);
    expect(s.roundLeader).toBe('p1'); // tie-break counts as a round win
  });

  it('Nilfgaard mirror: a tie stays a tie and both lose a gem', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr', hand: ['nr_ves'] },
      p2: { leader: 'ng_emhyr', hand: ['nr_keira'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2');
    expect(s.roundHistory[0].winner).toBeNull();
    expect(s.players.p1.gems).toBe(1);
    expect(s.players.p2.gems).toBe(1);
  });

  it('named scenario: Monsters keeps ONE random Monsters unit on the board between rounds', () => {
    const state = makeState({
      p2: {
        // Monsters side: two faction units + one neutral — only faction units qualify.
        rows: { melee: ['mon_fiend', 'mon_werewolf'], siege: ['neu_ciri'] },
        hand: ['mon_ghoul'],
      },
      p1: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // p2 wins the round (board strength)

    expect(s.round).toBe(2);
    const surviving = boardIds(s, 'p2');
    expect(surviving).toHaveLength(1);
    const keptDef = [
      ...s.players.p2.rows.melee.units,
      ...s.players.p2.rows.ranged.units,
      ...s.players.p2.rows.siege.units,
    ][0].defId;
    expect(['mon_fiend', 'mon_werewolf']).toContain(keptDef); // never the neutral Ciri
    // Ciri is a hero; she clears to the graveyard with everything else.
    expect(s.players.p2.graveyard.map((c) => c.defId)).toContain('neu_ciri');
    expect(s.players.p2.graveyard).toHaveLength(2);
  });

  it('Monsters keeps nothing when no Monsters-faction unit is on the board', () => {
    const state = makeState({
      p2: { rows: { siege: ['neu_ciri'] }, hand: ['mon_ghoul'] },
      p1: { hand: ['nr_ves'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2');
    expect(boardIds(s, 'p2')).toHaveLength(0);
  });

  it("Scoia'tael chooses who goes first (choice gates everything else)", () => {
    const state = makeState({
      phase: 'mulligan',
      round: 0,
      p1: { leader: 'nr_foltest', mulliganDone: false, hand: ['nr_ves'] },
      p2: { leader: 'st_francesca', faction: 'scoiatael', mulliganDone: false, hand: ['mon_ghoul'] },
      pendingChoice: { kind: 'choose_first_player', player: 'p2' },
      turn: 'p2',
    });

    // Only the elf player may act, and only via CHOOSE_FIRST_PLAYER.
    expect(getLegalMoves(state, 'p1')).toEqual([]);
    expect(getLegalMoves(state, 'p2').map((m) => m.type)).toEqual([
      'CHOOSE_FIRST_PLAYER',
      'CHOOSE_FIRST_PLAYER',
    ]);
    expect(() =>
      applyMove(state, { type: 'MULLIGAN', player: 'p1', cardInstanceIds: [] }),
    ).toThrowError(GwentError);
    expect(() =>
      applyMove(state, { type: 'CHOOSE_FIRST_PLAYER', player: 'p1', first: 'p1' }),
    ).toThrowError(GwentError);

    // The elf makes the OPPONENT go first.
    let s = applyMove(state, { type: 'CHOOSE_FIRST_PLAYER', player: 'p2', first: 'p1' });
    expect(s.pendingChoice).toBeNull();
    expect(s.roundLeader).toBe('p1');

    // Mulligans now proceed, then play starts with the chosen leader.
    s = applyMove(s, { type: 'MULLIGAN', player: 'p1', cardInstanceIds: [] });
    s = applyMove(s, { type: 'MULLIGAN', player: 'p2', cardInstanceIds: [] });
    expect(s.phase).toBe('play');
    expect(s.turn).toBe('p1');
  });
});
