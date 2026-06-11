/**
 * Hot-seat app store (zustand). Thin shell around the engine:
 *  - holds the authoritative GameState for the device
 *  - tracks which player's eyes the screen currently serves (`viewer`)
 *  - inserts a pass-the-phone privacy gate whenever the next required input
 *    belongs to the other player
 *  - turns engine events (auto-passes, round ends) into one-line notices
 *
 * Components NEVER read GameState directly — they render a PlayerView via
 * selectView(), preserving the engine's information model on screen.
 */

import { create } from 'zustand';
import { applyMove } from '../engine/apply';
import { createGame } from '../engine/game';
import { getView } from '../engine/view';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../engine/data/decks';
import { GwentError } from '../engine/types';
import type { GameConfig, GameState, Move, PlayerId, PlayerView } from '../engine/types';
import { playerLabel } from './cardInfo';

const HOTSEAT_CONFIG: GameConfig = {
  players: {
    p1: { deck: NORTHERN_REALMS_STARTER },
    p2: { deck: MONSTERS_STARTER },
  },
};

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
  return `hotseat-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

interface Session {
  state: GameState;
  /** Whose hand/secrets the screen is allowed to show. */
  viewer: PlayerId;
  /** Non-null → privacy screen is up, waiting for this player to take over. */
  handoffTo: PlayerId | null;
  /** Transient context line (auto-pass, round result, rejected move). */
  notice: string | null;
}

interface AppStore {
  screen: 'home' | 'game';
  session: Session | null;
  startHotSeat(): void;
  rematch(): void;
  dispatchMove(move: Move): void;
  confirmHandoff(): void;
  quitToHome(): void;
}

function newSession(): Session {
  const state = createGame(HOTSEAT_CONFIG, freshSeed());
  const actor = actorOf(state);
  // Gate even the very first look, so player 2 never glimpses player 1's hand.
  return { state, viewer: actor, handoffTo: actor, notice: null };
}

export const useAppStore = create<AppStore>((set, get) => ({
  screen: 'home',
  session: null,

  startHotSeat() {
    set({ screen: 'game', session: newSession() });
  },

  rematch() {
    set({ screen: 'game', session: newSession() });
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
    // Forced passes (someone ran out of cards) — only worth saying while the
    // same round is still on screen.
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
    const needsHandoff = next.phase !== 'finished' && nextActor !== session.viewer;
    set({
      session: {
        state: next,
        viewer: session.viewer,
        handoffTo: needsHandoff ? nextActor : null,
        notice: notes.length > 0 ? notes.join('\n') : null,
      },
    });
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
}));

/** The PlayerView for the current viewer — the ONLY game data the UI reads. */
export function selectView(store: AppStore): PlayerView | null {
  return store.session ? getView(store.session.state, store.session.viewer) : null;
}
