/**
 * App store (zustand). Thin shell around the engine:
 *  - holds the authoritative GameState for the device
 *  - tracks which player's eyes the screen currently serves (`viewer`)
 *  - hot-seat: inserts a pass-the-phone privacy gate whenever the next input
 *    belongs to the other player
 *  - vs AI: the human is always p1; the AI (src/ai) plays p2 on a short
 *    "thinking" delay, looping through consecutive turns and medic chains
 *  - turns engine events (auto-passes, round ends) into one-line notices
 *
 * Components NEVER read hidden GameState fields — they render a PlayerView
 * via getView, preserving the engine's information model on screen.
 */

import { create } from 'zustand';
import { applyMove } from '../engine/apply';
import { createGame } from '../engine/game';
import { getView } from '../engine/view';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../engine/data/decks';
import { GwentError } from '../engine/types';
import type { GameConfig, GameState, Move, PlayerId } from '../engine/types';
import { chooseMove, type Difficulty } from '../ai/agent';
import { playerLabel } from './cardInfo';

const HOTSEAT_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

const AI_PLAYER: PlayerId = 'p2';
const AI_THINK_MS = 600;

export type GameMode = 'hotseat' | 'ai';

/** Whose input is the game waiting for right now? */
export function actorOf(state: GameState): PlayerId {
  if (state.pendingChoice) {
    return state.pendingChoice.player;
  }
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganDone ? 'p2' : 'p1';
  }
  return state.turn;
}

function freshSeed(): string {
  // UI layer may use wall-clock/Math.random — the engine only sees the string.
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

interface Session {
  state: GameState;
  mode: GameMode;
  aiDifficulty: Difficulty;
  /** Whose hand/secrets the screen is allowed to show. */
  viewer: PlayerId;
  /** Non-null → privacy screen is up, waiting for this player (hot-seat only). */
  handoffTo: PlayerId | null;
  /** Transient context line (auto-pass, round result, rejected move). */
  notice: string | null;
}

interface AppStore {
  screen: 'home' | 'game';
  session: Session | null;
  startHotSeat(): void;
  startVsAi(difficulty: Difficulty): void;
  rematch(): void;
  dispatchMove(move: Move): void;
  confirmHandoff(): void;
  quitToHome(): void;
}

function newSession(mode: GameMode, aiDifficulty: Difficulty): Session {
  const state = createGame(HOTSEAT_CONFIG, `${mode}-${freshSeed()}`);
  const actor = actorOf(state);
  return {
    state,
    mode,
    aiDifficulty,
    viewer: mode === 'ai' ? 'p1' : actor,
    // Hot-seat gates even the very first look, so P2 never glimpses P1's hand.
    handoffTo: mode === 'ai' ? null : actor,
    notice: null,
  };
}

let aiTimerPending = false;

export const useAppStore = create<AppStore>((set, get) => {
  function scheduleAiIfNeeded(): void {
    const session = get().session;
    if (
      !session ||
      session.mode !== 'ai' ||
      session.state.result !== null ||
      actorOf(session.state) !== AI_PLAYER ||
      aiTimerPending
    ) {
      return;
    }
    aiTimerPending = true;
    setTimeout(() => {
      aiTimerPending = false;
      const current = get().session;
      if (!current || current.mode !== 'ai' || current.state.result !== null) {
        return;
      }
      if (actorOf(current.state) !== AI_PLAYER) {
        return;
      }
      const view = getView(current.state, AI_PLAYER);
      get().dispatchMove(chooseMove(view, current.aiDifficulty));
      // dispatchMove re-schedules if the AI still owes input (chains, passes).
    }, AI_THINK_MS);
  }

  return {
    screen: 'home',
    session: null,

    startHotSeat() {
      set({ screen: 'game', session: newSession('hotseat', 'normal') });
    },

    startVsAi(difficulty: Difficulty) {
      set({ screen: 'game', session: newSession('ai', difficulty) });
      scheduleAiIfNeeded();
    },

    rematch() {
      const prev = get().session;
      const mode = prev?.mode ?? 'hotseat';
      set({ screen: 'game', session: newSession(mode, prev?.aiDifficulty ?? 'normal') });
      scheduleAiIfNeeded();
    },

    dispatchMove(move: Move) {
      const session = get().session;
      if (!session) {
        return;
      }
      const prev = session.state;
      let next: GameState;
      try {
        next = applyMove(prev, move);
      } catch (error) {
        if (error instanceof GwentError) {
          set({ session: { ...session, notice: error.message } });
          return;
        }
        throw error;
      }

      const notes: string[] = [];
      // Forced passes (someone ran out of cards) — only worth saying while
      // the same round is still on screen.
      if (next.phase === 'play' && next.round === prev.round) {
        for (const p of ['p1', 'p2'] as const) {
          const wasOwnPass = move.type === 'PASS' && move.player === p;
          if (!prev.players[p].passed && next.players[p].passed && !wasOwnPass) {
            notes.push(`${playerLabel(next, p)} has no cards left — passed automatically.`);
          }
        }
      }
      // Round results that landed during this move.
      for (let i = prev.roundHistory.length; i < next.roundHistory.length; i++) {
        const r = next.roundHistory[i];
        const score = `${r.totals.p1}:${r.totals.p2}`;
        notes.push(
          r.winner === null
            ? `Round ${r.round} tied at ${score} — both lose a gem!`
            : `Round ${r.round} (${score}) goes to ${playerLabel(next, r.winner)}` +
                `${r.tieBrokenByNilfgaard ? ' — Nilfgaard wins ties' : ''}.`,
        );
      }

      const nextActor = actorOf(next);
      const needsHandoff =
        session.mode === 'hotseat' && next.phase !== 'finished' && nextActor !== session.viewer;
      set({
        session: {
          ...session,
          state: next,
          handoffTo: needsHandoff ? nextActor : null,
          notice: notes.length > 0 ? notes.join('\n') : null,
        },
      });
      scheduleAiIfNeeded();
    },

    confirmHandoff() {
      const session = get().session;
      if (!session || session.handoffTo === null) {
        return;
      }
      set({
        session: { ...session, viewer: session.handoffTo, handoffTo: null, notice: null },
      });
    },

    quitToHome() {
      set({ screen: 'home', session: null });
    },
  };
});
