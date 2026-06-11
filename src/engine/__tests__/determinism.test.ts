import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { createGame } from '../game.ts';
import { getLegalMoves } from '../legal.ts';
import { getView } from '../view.ts';
import { rngInt, seedToRngState } from '../rng.ts';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../data/decks.ts';
import type { GameConfig, GameState, Move, PlayerId } from '../types.ts';

const STARTER_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

/** Whose input is the game waiting for? */
function pickActor(state: GameState): PlayerId {
  if (state.pendingChoice) {
    return state.pendingChoice.player;
  }
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganDone ? 'p2' : 'p1';
  }
  return state.turn;
}

/** Play a full random-legal-move game; optionally record every move. */
function driveGame(seed: string, record?: Move[]): GameState {
  let state = createGame(STARTER_CONFIG, seed);
  let botRng = seedToRngState(`bot-${seed}`);
  let guard = 0;
  while (!state.result) {
    if (++guard > 600) {
      throw new Error(`game ${seed} did not terminate within 600 moves`);
    }
    const actor = pickActor(state);
    const moves = getLegalMoves(state, actor);
    if (moves.length === 0) {
      throw new Error(`game ${seed}: no legal moves for ${actor} (${state.phase})`);
    }
    const [index, nextRng] = rngInt(botRng, moves.length);
    botRng = nextRng;
    const move = moves[index];
    record?.push(move);
    state = applyMove(state, move);
  }
  return state;
}

describe('named scenario: determinism', () => {
  it('100 random games: same seed + same move list ⇒ deep-equal final states', () => {
    for (let i = 0; i < 100; i++) {
      const seed = `determinism-${i}`;
      const moves: Move[] = [];
      const original = driveGame(seed, moves);

      // Replay the recorded move list on a fresh game with the same seed.
      let replay = createGame(STARTER_CONFIG, seed);
      for (const move of moves) {
        replay = applyMove(replay, move);
      }

      expect(replay).toEqual(original);
      expect(replay.result).not.toBeNull();
      // Sanity: every match ends within 3 rounds with a winner or a draw.
      expect(original.roundHistory.length).toBeLessThanOrEqual(3);
    }
  });

  it('applyMove never mutates its input state', () => {
    const state = createGame(STARTER_CONFIG, 'purity');
    const snapshot = JSON.stringify(state);
    const actor = pickActor(state);
    const move = getLegalMoves(state, actor)[0];
    applyMove(state, move);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('information hiding (PlayerView)', () => {
  it('a view never contains hidden instance ids (opponent hand, both decks)', () => {
    // Walk a game a few moves into the play phase, checking the invariant
    // after every move for both players.
    let state = createGame(STARTER_CONFIG, 'info-hiding');
    let botRng = seedToRngState('info-hiding-bot');
    for (let step = 0; step < 30 && !state.result; step++) {
      const actor = pickActor(state);
      const moves = getLegalMoves(state, actor);
      const [index, nextRng] = rngInt(botRng, moves.length);
      botRng = nextRng;
      state = applyMove(state, moves[index]);

      for (const viewer of ['p1', 'p2'] as const) {
        const opponent: PlayerId = viewer === 'p1' ? 'p2' : 'p1';
        const view = getView(state, viewer);
        const serialized = JSON.stringify(view);
        const revealed = new Set(view.opponent.revealedHand.map((c) => c.instanceId));

        for (const hidden of state.players[opponent].hand) {
          if (!revealed.has(hidden.instanceId)) {
            expect(serialized).not.toContain(`"${hidden.instanceId}"`);
          }
        }
        for (const p of ['p1', 'p2'] as const) {
          for (const deckCard of state.players[p].deck) {
            expect(serialized).not.toContain(`"${deckCard.instanceId}"`);
          }
        }
      }
    }
  });

  it('exposes counts and public zones', () => {
    const state = createGame(STARTER_CONFIG, 'view-shape');
    const view = getView(state, 'p1');
    expect(view.you.hand).toHaveLength(10);
    expect(view.opponent.handCount).toBe(10);
    expect(view.you.deckCount).toBe(state.players.p1.deck.length);
    expect(view.opponent.deckCount).toBe(state.players.p2.deck.length);
    expect(view.opponent.leader.defId).toBe('mon_eredin'); // leaders are public
    expect(view.legalMoves.length).toBeGreaterThan(0); // mulligan options
  });
});
