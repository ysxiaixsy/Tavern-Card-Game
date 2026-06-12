import { describe, expect, it } from 'vitest';
import { applyMove } from '../../engine/apply.ts';
import { createGame } from '../../engine/game.ts';
import { getView } from '../../engine/view.ts';
import {
  MONSTERS_STARTER,
  NILFGAARD_STARTER,
  NORTHERN_REALMS_STARTER,
  SCOIATAEL_STARTER,
} from '../../engine/data/decks.ts';
import type { GameConfig, GameState, Move, PlayerId } from '../../engine/types.ts';
import { makeState, play } from '../../engine/__tests__/testkit.ts';
import { chooseMove, type Difficulty } from '../agent.ts';

const STARTER_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

const NG_ST_CONFIG: GameConfig = {
  players: {
    p1: { deck: NILFGAARD_STARTER },
    p2: { deck: SCOIATAEL_STARTER },
  },
};

function pickActor(state: GameState): PlayerId {
  if (state.pendingChoice) {
    return state.pendingChoice.player;
  }
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganDone ? 'p2' : 'p1';
  }
  return state.turn;
}

/** Full AI-vs-AI game; asserts every chosen move is one of the legal moves. */
function playFullGame(
  seed: string,
  p1: Difficulty,
  p2: Difficulty,
  config: GameConfig = STARTER_CONFIG,
): GameState {
  let state = createGame(config, seed);
  let guard = 0;
  while (!state.result) {
    if (++guard > 400) {
      throw new Error(`AI game ${seed} did not terminate`);
    }
    const actor = pickActor(state);
    const view = getView(state, actor);
    const move = chooseMove(view, actor === 'p1' ? p1 : p2);
    expect(view.legalMoves).toContain(move); // identity: AI returns engine-offered moves
    state = applyMove(state, move);
  }
  return state;
}

describe('chooseMove legality and termination', () => {
  it('normal vs normal: full games end legally', () => {
    for (const seed of ['ai-n-1', 'ai-n-2', 'ai-n-3', 'ai-n-4', 'ai-n-5']) {
      const final = playFullGame(seed, 'normal', 'normal');
      expect(final.result).not.toBeNull();
    }
  });

  it('easy vs normal: full games end legally', () => {
    for (const seed of ['ai-e-1', 'ai-e-2', 'ai-e-3']) {
      playFullGame(seed, 'easy', 'normal');
    }
  });

  it('hard vs normal: full games end legally', () => {
    for (const seed of ['ai-h-1', 'ai-h-2']) {
      playFullGame(seed, 'hard', 'normal');
    }
  });

  it('Nilfgaard vs Scoia\'tael: the AI handles spies-heavy and agile decks', () => {
    for (const seed of ['ai-ngst-1', 'ai-ngst-2']) {
      const final = playFullGame(seed, 'normal', 'normal', NG_ST_CONFIG);
      expect(final.result).not.toBeNull();
    }
  });

  it('is deterministic: same view ⇒ same move', () => {
    const state = makeState({
      p1: { hand: ['nr_stennis', 'neu_vesemir', 'nr_keira', 'neu_frost'] },
      p2: { hand: ['mon_fiend', 'mon_ghoul'], rows: { melee: ['mon_werewolf'] } },
    });
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const a = chooseMove(getView(state, 'p1'), difficulty);
      const b = chooseMove(getView(state, 'p1'), difficulty);
      expect(a).toEqual(b);
    }
  });
});

describe('card economy (normal)', () => {
  it('passes immediately when the opponent passed and it leads', () => {
    const state = makeState({
      p1: { hand: ['nr_keira', 'nr_ves'], rows: { melee: ['neu_vesemir'] } }, // leads 6:0
      p2: { hand: ['mon_fiend'], passed: true },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    expect(move.type).toBe('PASS');
  });

  it('concedes a hopeless round instead of bleeding cards', () => {
    const state = makeState({
      p1: { hand: ['nr_yarpen', 'nr_ves', 'nr_keira'] }, // 12 points available
      p2: {
        rows: { melee: ['mon_draug', 'mon_imlerith'], ranged: ['mon_leshen'] }, // 30, passed
        hand: ['mon_fiend'],
        passed: true,
      },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    expect(move.type).toBe('PASS');
  });

  it('dumps a spy before conceding', () => {
    const state = makeState({
      p1: { hand: ['nr_stennis', 'nr_yarpen'], deck: ['nr_ves', 'nr_keira', 'nr_sile'] },
      p2: {
        rows: { melee: ['mon_draug', 'mon_imlerith'], ranged: ['mon_leshen'] },
        hand: ['mon_fiend'],
        passed: true,
      },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    expect(move.type).toBe('PLAY_CARD');
    const spy = state.players.p1.hand[0];
    expect((move as { cardInstanceId: string }).cardInstanceId).toBe(spy.instanceId);
  });

  it('plays the cheapest card that flips a close round', () => {
    const state = makeState({
      p1: { hand: ['neu_geralt', 'nr_yarpen', 'nr_dethmold'] }, // 15 / 2 / 6
      p2: { rows: { melee: ['mon_werewolf'] }, hand: ['mon_fiend'], passed: true }, // 5
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    expect(move.type).toBe('PLAY_CARD');
    // Dethmold (6) flips 0:5 — Geralt would be a waste, Yarpen wouldn't flip.
    const dethmold = state.players.p1.hand[2];
    expect((move as { cardInstanceId: string }).cardInstanceId).toBe(dethmold.instanceId);
  });
});

describe('opening priorities and toolbox use (normal)', () => {
  it('plays spies before anything else in an open round', () => {
    const state = makeState({
      p1: { hand: ['nr_stennis', 'neu_vesemir', 'neu_frost'], deck: ['nr_ves', 'nr_keira'] },
      p2: { hand: ['mon_fiend', 'mon_ghoul'] },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    const spy = state.players.p1.hand[0];
    expect((move as { cardInstanceId: string }).cardInstanceId).toBe(spy.instanceId);
  });

  it('plays weather when the opponent loses far more than it does', () => {
    const state = makeState({
      p1: { hand: ['neu_frost', 'nr_keira'], rows: { melee: ['nr_yarpen'] } },
      p2: {
        hand: ['mon_ghoul'],
        rows: { melee: ['mon_fiend', 'mon_werewolf', 'mon_griffin'] }, // 16 to lose
      },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    const frost = state.players.p1.hand[0];
    expect((move as { cardInstanceId: string }).cardInstanceId).toBe(frost.instanceId);
  });

  it('holds weather that would hurt itself more', () => {
    const state = makeState({
      p1: { hand: ['neu_frost', 'nr_keira'], rows: { melee: ['neu_vesemir', 'nr_siegfried'] } },
      p2: { hand: ['mon_ghoul'], rows: { melee: ['mon_nekker'] } },
    });
    const move = chooseMove(getView(state, 'p1'), 'normal');
    const frost = state.players.p1.hand[0];
    expect((move as { cardInstanceId?: string }).cardInstanceId).not.toBe(frost.instanceId);
  });

  it('medic revive priority: spy over the biggest body', () => {
    const state = makeState({
      p1: {
        hand: ['nr_dun_banner_medic', 'nr_ves'],
        deck: ['nr_keira', 'nr_sile'],
        graveyard: ['nr_catapult', 'nr_stennis'],
      },
      p2: { hand: ['mon_fiend'] },
    });
    const pending = play(state, 'p1', 'nr_dun_banner_medic');
    const move = chooseMove(getView(pending, 'p1'), 'normal');
    expect(move.type).toBe('RESOLVE_MEDIC');
    const spy = pending.players.p1.graveyard.find((c) => c.defId === 'nr_stennis');
    expect((move as { targetInstanceId: string }).targetInstanceId).toBe(spy?.instanceId);
  });

  it('mulligans away duplicate weather', () => {
    let state = createGame(STARTER_CONFIG, 'mulligan-ai');
    // Force a known hand: two frosts + bodies.
    state = JSON.parse(JSON.stringify(state)) as GameState;
    const p2 = state.players.p2;
    const fromDeck = (defId: string, n: number) =>
      p2.deck.filter((c) => c.defId === defId).slice(0, n);
    const frosts = fromDeck('neu_frost', 2);
    if (frosts.length === 2) {
      // Swap two random hand cards for the two frosts (test-only surgery).
      const removed = p2.hand.splice(0, 2);
      p2.deck = p2.deck.filter((c) => !frosts.includes(c)).concat(removed);
      p2.hand.push(...frosts);
    }
    state.players.p1.mulliganDone = true;
    const view = getView(state, 'p2');
    const move = chooseMove(view, 'normal');
    expect(move.type).toBe('MULLIGAN');
    if (frosts.length === 2) {
      expect((move as { cardInstanceIds: string[] }).cardInstanceIds).toContain(
        frosts[1].instanceId,
      );
    }
  });
});

describe('easy difficulty', () => {
  it('greedily plays the biggest body and ignores the spy', () => {
    const state = makeState({
      p1: { hand: ['nr_stennis', 'neu_vesemir', 'neu_frost'], deck: ['nr_ves'] },
      p2: { hand: ['mon_fiend'] },
    });
    const move = chooseMove(getView(state, 'p1'), 'easy');
    const vesemir = state.players.p1.hand[1];
    expect((move as { cardInstanceId: string }).cardInstanceId).toBe(vesemir.instanceId);
  });

  it('never passes while the opponent is still active', () => {
    const state = makeState({
      p1: { hand: ['nr_yarpen'], rows: { melee: ['neu_vesemir'] } },
      p2: { hand: ['mon_fiend'] },
    });
    const move = chooseMove(getView(state, 'p1'), 'easy');
    expect(move.type).not.toBe('PASS');
  });
});

describe('relative strength', () => {
  it('normal beats easy on mirrored decks (fixed seeds)', () => {
    // Mirrors isolate skill from deck texture (e.g. Easy "accidentally"
    // playing muster decks well). Deterministic: AI + seeds are fixed.
    const mirrors: GameConfig[] = [
      { players: { p1: { deck: NORTHERN_REALMS_STARTER }, p2: { deck: NORTHERN_REALMS_STARTER } } },
      { players: { p1: { deck: MONSTERS_STARTER }, p2: { deck: MONSTERS_STARTER } } },
    ];
    let normalWins = 0;
    let games = 0;
    for (const [m, config] of mirrors.entries()) {
      for (let i = 0; i < 6; i++) {
        const normalSide: PlayerId = i % 2 === 0 ? 'p1' : 'p2';
        const final = playFullGame(
          `arena-mirror-${m}-${i}`,
          normalSide === 'p1' ? 'normal' : 'easy',
          normalSide === 'p2' ? 'normal' : 'easy',
          config,
        );
        games += 1;
        if (final.result?.winner === normalSide) {
          normalWins += 1;
        }
      }
    }
    expect(games).toBe(12);
    expect(normalWins).toBeGreaterThanOrEqual(7);
  });
});
