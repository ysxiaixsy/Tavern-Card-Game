import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { createGame } from '../game.ts';
import { getLegalMoves } from '../legal.ts';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../data/decks.ts';
import { GwentError, type GameConfig } from '../types.ts';
import { makeState, pass, play } from './testkit.ts';

const STARTER_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

describe('mulligan phase', () => {
  it('swaps up to 2 cards, keeps hand at 10, then play begins', () => {
    let state = createGame(STARTER_CONFIG, 'mulligan-test');
    expect(state.phase).toBe('mulligan');
    expect(state.players.p1.hand).toHaveLength(10);
    const deckSize = NORTHERN_REALMS_STARTER.cardIds.length - 10;
    expect(state.players.p1.deck).toHaveLength(deckSize);

    const [a, b] = state.players.p1.hand;
    state = applyMove(state, {
      type: 'MULLIGAN',
      player: 'p1',
      cardInstanceIds: [a.instanceId, b.instanceId],
    });
    expect(state.players.p1.hand).toHaveLength(10);
    expect(state.players.p1.deck).toHaveLength(deckSize);
    expect(state.players.p1.mulligansUsed).toBe(2);
    expect(state.phase).toBe('mulligan'); // p2 still owes a mulligan
    expect(getLegalMoves(state, 'p1')).toEqual([]); // one submission only

    state = applyMove(state, { type: 'MULLIGAN', player: 'p2', cardInstanceIds: [] });
    expect(state.phase).toBe('play');
    expect(state.round).toBe(1);
    expect(state.turn).toBe(state.roundLeader);
  });

  it('rejects swapping more than 2 or cards not in hand', () => {
    const state = createGame(STARTER_CONFIG, 'mulligan-reject');
    const [a, b, c] = state.players.p1.hand;
    expect(() =>
      applyMove(state, {
        type: 'MULLIGAN',
        player: 'p1',
        cardInstanceIds: [a.instanceId, b.instanceId, c.instanceId],
      }),
    ).toThrowError(GwentError);
    expect(() =>
      applyMove(state, { type: 'MULLIGAN', player: 'p1', cardInstanceIds: ['bogus'] }),
    ).toThrowError(GwentError);
  });

  it('no card may be played before mulligans complete', () => {
    const state = createGame(STARTER_CONFIG, 'too-early');
    const card = state.players.p1.hand[0];
    expect(() =>
      applyMove(state, { type: 'PLAY_CARD', player: 'p1', cardInstanceId: card.instanceId }),
    ).toThrowError(GwentError);
  });
});

describe('named scenario: pass lockout', () => {
  it('after passing, only the opponent acts until the round ends', () => {
    const state = makeState({
      p1: { hand: ['nr_ves', 'nr_keira'] },
      p2: { hand: ['mon_fiend', 'mon_werewolf', 'mon_griffin'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    expect(s.players.p1.passed).toBe(true);
    expect(s.turn).toBe('p2');
    expect(getLegalMoves(s, 'p1')).toEqual([]);
    expect(() => play(s, 'p1', 'nr_ves')).toThrowError(GwentError);
    expect(() => pass(s, 'p1')).toThrowError(GwentError);

    // p2 takes several consecutive turns against the passed p1.
    s = play(s, 'p2', 'mon_fiend');
    expect(s.turn).toBe('p2');
    s = play(s, 'p2', 'mon_werewolf');
    expect(s.turn).toBe('p2');

    // p2 passes too → round resolves, hands carry over untouched.
    s = pass(s, 'p2');
    expect(s.round).toBe(2);
    expect(s.players.p1.hand).toHaveLength(2);
    expect(s.players.p2.hand).toHaveLength(1);
    expect(s.roundHistory[0].winner).toBe('p2');
    expect(s.turn).toBe('p2'); // round winner leads the next round
  });
});

describe('named scenario: forced pass and match end', () => {
  it('a player with an empty hand is force-passed when the turn reaches them', () => {
    const state = makeState({
      p1: { hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend', 'mon_werewolf'] },
      turn: 'p1',
    });
    let s = play(state, 'p1', 'nr_ves'); // p1's last card
    expect(s.turn).toBe('p2');
    s = play(s, 'p2', 'mon_fiend');
    // Turn would return to p1 (hand empty) → auto-passed → p2 continues alone.
    expect(s.players.p1.passed).toBe(true);
    expect(s.turn).toBe('p2');
  });

  it('match ends when a player drops to 0 gems', () => {
    const state = makeState({
      p1: { gems: 1, rows: { melee: ['neu_vesemir'] }, hand: ['nr_ves'] },
      p2: { gems: 1, hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // p1 wins 6:0 → p2 hits 0 gems
    expect(s.phase).toBe('finished');
    expect(s.result?.winner).toBe('p1');
    expect(s.result?.gems).toEqual({ p1: 1, p2: 0 });
    expect(getLegalMoves(s, 'p1')).toEqual([]);
    expect(() => pass(s, 'p2')).toThrowError(GwentError);
  });

  it('simultaneous 0–0 gems is a draw', () => {
    const state = makeState({
      p1: { gems: 1, hand: ['nr_ves'] },
      p2: { gems: 1, hand: ['mon_fiend'] },
      turn: 'p1',
    });
    let s = pass(state, 'p1');
    s = pass(s, 'p2'); // 0:0 tie → both lose their last gem
    expect(s.phase).toBe('finished');
    expect(s.result?.winner).toBeNull();
    expect(s.result?.gems).toEqual({ p1: 0, p2: 0 });
  });

  it('both hands empty cascades through forced passes to the end of the match', () => {
    const state = makeState({
      p1: { hand: ['nr_ves'] },
      p2: {},
      turn: 'p1',
    });
    // p1 plays their last card; p2's hand is already empty. The rest of the
    // match resolves by forced passes: r1 p1 wins 5:0 (p2 → 1 gem), r2 ties
    // 0:0 (p1 → 1, p2 → 0) — match over after two rounds.
    const s = play(state, 'p1', 'nr_ves');
    expect(s.phase).toBe('finished');
    expect(s.roundHistory.map((r) => r.winner)).toEqual(['p1', null]);
    expect(s.result?.winner).toBe('p1');
    expect(s.result?.gems).toEqual({ p1: 1, p2: 0 });
  });
});

describe('round leadership', () => {
  it('the round winner leads the next round; a tie keeps the same leader', () => {
    // Tie first: crafted equal boards.
    const tied = makeState({
      p1: { rows: { melee: ['neu_vesemir'] }, hand: ['nr_ves'] },
      p2: { rows: { melee: ['mon_fiend'] }, hand: ['mon_ghoul'] },
      turn: 'p2', // p2 led this round
      roundLeader: 'p2',
    });
    let s = pass(tied, 'p2');
    s = pass(s, 'p1'); // 6:6 tie
    expect(s.roundHistory[0].winner).toBeNull();
    expect(s.roundLeader).toBe('p2'); // tie → leader unchanged
    expect(s.turn).toBe('p2');
  });
});
