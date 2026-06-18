import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { validateDeck } from '../game.ts';
import { SKELLIGE_STARTER } from '../data/decks.ts';
import { ROW_KINDS } from '../helpers.ts';
import type { Move, PlayerId } from '../types.ts';
import { makeState, pass } from './testkit.ts';

const boardDefs = (s: ReturnType<typeof makeState>, p: PlayerId): string[] =>
  ROW_KINDS.flatMap((r) => s.players[p].rows[r].units.map((u) => u.defId));

describe('Skellige — deck legality', () => {
  it('the Skellige starter deck is legal', () => {
    expect(() => validateDeck(SKELLIGE_STARTER)).not.toThrow();
  });
});

describe('Skellige — Crach an Craite (reshuffle graveyards into decks)', () => {
  it('returns both graveyards to their own decks and reshuffles', () => {
    const state = makeState({
      p1: {
        leader: 'sk_crach',
        hand: ['nr_ves'],
        deck: ['sk_holger'],
        graveyard: ['sk_brokvar', 'sk_donar'],
      },
      p2: { hand: ['mon_fiend'], graveyard: ['mon_ghoul'] },
    });
    const move = getLegalMoves(state, 'p1').find((m) => m.type === 'USE_LEADER');
    expect(move).toBeDefined();
    const s = applyMove(state, move as Move);

    expect(s.players.p1.graveyard).toHaveLength(0);
    expect(s.players.p1.deck.map((c) => c.defId).sort()).toEqual(['sk_brokvar', 'sk_donar', 'sk_holger']);
    expect(s.players.p2.graveyard).toHaveLength(0);
    expect(s.players.p2.deck.map((c) => c.defId)).toEqual(['mon_ghoul']);
    expect(s.players.p1.leaderUsed).toBe(true);
  });

  it('is not offered when both graveyards are empty', () => {
    const state = makeState({ p1: { leader: 'sk_crach', hand: ['nr_ves'] }, p2: { hand: ['mon_fiend'] } });
    expect(getLegalMoves(state, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(false);
  });
});

describe('Skellige — faction perk (round 3 returns 2 random graveyard units)', () => {
  it('revives two units to the board only at the start of round 3', () => {
    const state = makeState({
      round: 2,
      p1: { leader: 'sk_crach', hand: ['nr_ves'], graveyard: ['sk_brokvar', 'sk_donar', 'sk_holger'] },
      p2: { hand: ['mon_fiend'] }, // Monsters — no Skellige perk
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // round 2 resolves → round 3 setup → perk fires
    expect(s.round).toBe(3);
    expect(boardDefs(s, 'p1')).toHaveLength(2); // two revived onto their rows
    expect(s.players.p1.graveyard).toHaveLength(1); // 3 − 2
    expect(boardDefs(s, 'p2')).toHaveLength(0); // opponent gets nothing
  });

  it('does NOT fire in round 2', () => {
    const state = makeState({
      round: 1,
      p1: { leader: 'sk_crach', hand: ['nr_ves'], graveyard: ['sk_brokvar', 'sk_donar'] },
      p2: { hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // round 1 → round 2: no perk
    expect(s.round).toBe(2);
    expect(boardDefs(s, 'p1')).toHaveLength(0);
    expect(s.players.p1.graveyard).toHaveLength(2);
  });
});

describe('Skellige — Kambi summons Hemdall (Summon Avenger)', () => {
  it('a cleared Kambi brings Hemdall onto the board next round', () => {
    const state = makeState({
      p1: { leader: 'sk_crach', rows: { melee: ['sk_kambi'] }, hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // round 1 ends → Kambi cleared → Hemdall placed in round 2
    expect(s.round).toBe(2);
    expect(boardDefs(s, 'p1')).toContain('sk_hemdall');
  });
});
