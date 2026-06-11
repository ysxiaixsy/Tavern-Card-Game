import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { createGame, validateDeck } from '../game.ts';
import { getLegalMoves } from '../legal.ts';
import { rngInt, seedToRngState } from '../rng.ts';
import {
  NILFGAARD_STARTER,
  NORTHERN_REALMS_STARTER,
  SCOIATAEL_STARTER,
  STARTER_DECKS,
} from '../data/decks.ts';
import type { GameConfig, GameState, PlayerId } from '../types.ts';

function randomPlayout(config: GameConfig, seed: string): GameState {
  let state = createGame(config, seed);
  let botRng = seedToRngState(`bot-${seed}`);
  let guard = 0;
  while (!state.result) {
    if (++guard > 500) {
      throw new Error(`playout ${seed} did not terminate`);
    }
    const actor: PlayerId = state.pendingChoice
      ? state.pendingChoice.player
      : state.phase === 'mulligan'
        ? state.players.p1.mulliganDone
          ? 'p2'
          : 'p1'
        : state.turn;
    const moves = getLegalMoves(state, actor);
    const [pick, next] = rngInt(botRng, moves.length);
    botRng = next;
    state = applyMove(state, moves[pick]);
  }
  return state;
}

describe('all four starter decks', () => {
  it('pass deck validation', () => {
    for (const deck of Object.values(STARTER_DECKS)) {
      expect(() => validateDeck(deck)).not.toThrow();
    }
  });

  it('Nilfgaard vs Scoia\'tael random games play to completion', () => {
    const config: GameConfig = {
      players: { p1: { deck: NILFGAARD_STARTER }, p2: { deck: SCOIATAEL_STARTER } },
    };
    for (const seed of ['ng-st-1', 'ng-st-2']) {
      expect(randomPlayout(config, seed).result).not.toBeNull();
    }
  });
});

describe("Scoia'tael perks end-to-end (closes the M1 coverage gap)", () => {
  const config: GameConfig = {
    players: { p1: { deck: NORTHERN_REALMS_STARTER }, p2: { deck: SCOIATAEL_STARTER } },
  };

  it('Francesca auto-draws an 11th card and is consumed at match start', () => {
    const state = createGame(config, 'francesca-e2e');
    expect(state.players.p2.hand).toHaveLength(11);
    expect(state.players.p1.hand).toHaveLength(10);
    expect(state.players.p2.leaderUsed).toBe(true);
    expect(state.players.p1.leaderUsed).toBe(false);
  });

  it('the elf player chooses who goes first before mulligans begin', () => {
    let state = createGame(config, 'st-choice-e2e');
    expect(state.pendingChoice).toEqual({ kind: 'choose_first_player', player: 'p2' });
    // Everything else is gated until the choice resolves.
    expect(getLegalMoves(state, 'p1')).toEqual([]);

    state = applyMove(state, { type: 'CHOOSE_FIRST_PLAYER', player: 'p2', first: 'p1' });
    expect(state.pendingChoice).toBeNull();
    expect(state.roundLeader).toBe('p1');

    state = applyMove(state, { type: 'MULLIGAN', player: 'p1', cardInstanceIds: [] });
    state = applyMove(state, { type: 'MULLIGAN', player: 'p2', cardInstanceIds: [] });
    expect(state.phase).toBe('play');
    expect(state.turn).toBe('p1'); // the elf sent the opponent in first
  });

  it("Scoia'tael mirror: perks cancel — coin flip stands, both draw 11", () => {
    const mirror: GameConfig = {
      players: { p1: { deck: SCOIATAEL_STARTER }, p2: { deck: SCOIATAEL_STARTER } },
    };
    const state = createGame(mirror, 'st-mirror-e2e');
    expect(state.pendingChoice).toBeNull();
    expect(state.players.p1.hand).toHaveLength(11);
    expect(state.players.p2.hand).toHaveLength(11);
    expect(randomPlayout(mirror, 'st-mirror-play').result).not.toBeNull();
  });
});
