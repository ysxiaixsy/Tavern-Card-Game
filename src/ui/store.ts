/**
 * App store (zustand). Thin shell around the engine:
 *  - holds the authoritative GameState for the device
 *  - tracks which player's eyes the screen currently serves (`viewer`)
 *  - hot-seat: inserts a pass-the-phone privacy gate whenever the next input
 *    belongs to the other player
 *  - vs AI: the human is always p1; the AI (src/ai) plays p2 on a short
 *    "thinking" delay, looping through consecutive turns and medic chains
 *  - deck builder: custom decks persist via AsyncStorage; the four starters
 *    are immutable templates surfaced alongside them
 *
 * Components NEVER read hidden GameState fields — they render a PlayerView
 * via getView, preserving the engine's information model on screen.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyMove } from '../engine/apply';
import { actorOf, createGame } from '../engine/game';
import { getView } from '../engine/view';
import { getCardDef } from '../engine/data/cards';
import { STARTER_DECKS } from '../engine/data/decks';
import { GwentError } from '../engine/types';
import type { GameConfig, GameState, Move, PlayerId } from '../engine/types';
import { chooseMove, type Difficulty } from '../ai/agent';
import { playerLabel } from './cardInfo';

/** Factions with a complete card pool. */
export type PlayableFaction = keyof typeof STARTER_DECKS;

/** A deck as the builder stores it. Starters are synthesized, not persisted. */
export interface SavedDeck {
  id: string;
  name: string;
  faction: PlayableFaction;
  leaderId: string;
  cardIds: string[];
  builtin?: boolean;
}

const FACTION_NAMES: Record<PlayableFaction, string> = {
  northern_realms: 'Northern Realms',
  nilfgaard: 'Nilfgaard',
  monsters: 'Monsters',
  scoiatael: "Scoia'tael",
};

export const STARTER_SAVED_DECKS: SavedDeck[] = (
  Object.keys(STARTER_DECKS) as PlayableFaction[]
).map((faction) => ({
  id: `starter_${faction}`,
  name: `${FACTION_NAMES[faction]} Starter`,
  faction,
  leaderId: STARTER_DECKS[faction].leaderId,
  cardIds: [...STARTER_DECKS[faction].cardIds],
  builtin: true,
}));

const AI_PLAYER: PlayerId = 'p2';

/** How long the AI "thinks" before each move, by preference. */
export type AiSpeed = 'fast' | 'normal' | 'slow';
const AI_THINK_MS: Record<AiSpeed, number> = { fast: 250, normal: 600, slow: 1100 };

/** User preferences (persisted). See SettingsScreen. */
export interface Prefs {
  animations: boolean;
  haptics: boolean;
  confirmPass: boolean;
  aiSpeed: AiSpeed;
}

export const DEFAULT_PREFS: Prefs = {
  animations: true,
  haptics: true,
  confirmPass: true,
  aiSpeed: 'normal',
};

export type GameMode = 'hotseat' | 'ai';
export type Screen = 'home' | 'decks' | 'setup' | 'game' | 'online' | 'settings';

/** Pointer to the most recent online game, persisted for reconnects. */
export interface LastOnlineGame {
  gameId: string;
  roomCode: string;
}

export { actorOf };

function freshSeed(): string {
  // UI layer may use wall-clock/Math.random — the engine only sees the string.
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

interface Session {
  state: GameState;
  mode: GameMode;
  aiDifficulty: Difficulty;
  viewer: PlayerId;
  handoffTo: PlayerId | null;
  notice: string | null;
}

interface AppStore {
  screen: Screen;
  setupMode: GameMode;
  customDecks: SavedDeck[];
  session: Session | null;
  lastOnlineGame: LastOnlineGame | null;
  prefs: Prefs;
  // navigation
  goHome(): void;
  openDecks(): void;
  openOnline(): void;
  openSettings(): void;
  beginSetup(mode: GameMode): void;
  setLastOnlineGame(game: LastOnlineGame | null): void;
  setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  // deck management
  saveDeck(deck: SavedDeck): void;
  deleteDeck(id: string): void;
  // match flow
  startMatch(p1DeckId: string, p2DeckId: string, difficulty: Difficulty): string | null;
  rematch(): void;
  dispatchMove(move: Move): void;
  confirmHandoff(): void;
  quitToHome(): void;
}

/** Starters + custom decks, the full pick list. */
export function allDecks(customDecks: SavedDeck[]): SavedDeck[] {
  return [...STARTER_SAVED_DECKS, ...customDecks];
}

export function leaderShortName(leaderId: string): string {
  const name = getCardDef(leaderId).name;
  const comma = name.indexOf(',');
  return comma === -1 ? name : name.slice(comma + 1).trim();
}

function newSession(mode: GameMode, aiDifficulty: Difficulty, config: GameConfig): Session {
  const state = createGame(config, `${mode}-${freshSeed()}`);
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

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
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
        }, AI_THINK_MS[get().prefs.aiSpeed]);
      }

      return {
        screen: 'home' as Screen,
        setupMode: 'hotseat' as GameMode,
        customDecks: [],
        session: null,
        lastOnlineGame: null,
        prefs: DEFAULT_PREFS,

        goHome() {
          set({ screen: 'home', session: null });
        },

        openOnline() {
          set({ screen: 'online' });
        },

        openSettings() {
          set({ screen: 'settings' });
        },

        setLastOnlineGame(game: LastOnlineGame | null) {
          set({ lastOnlineGame: game });
        },

        setPref(key, value) {
          set((s) => ({ prefs: { ...s.prefs, [key]: value } }));
        },

        quitToHome() {
          set({ screen: 'home', session: null });
        },

        rematch() {
          const prev = get().session;
          if (!prev) {
            return;
          }
          // Same matchup (the config lives in the GameState), fresh shuffle.
          set({
            screen: 'game',
            session: newSession(prev.mode, prev.aiDifficulty, prev.state.config),
          });
          scheduleAiIfNeeded();
        },

        openDecks() {
          set({ screen: 'decks' });
        },

        beginSetup(mode: GameMode) {
          set({ screen: 'setup', setupMode: mode });
        },

        saveDeck(deck: SavedDeck) {
          set((s) => {
            const others = s.customDecks.filter((d) => d.id !== deck.id);
            return { customDecks: [...others, { ...deck, builtin: false }] };
          });
        },

        deleteDeck(id: string) {
          set((s) => ({ customDecks: s.customDecks.filter((d) => d.id !== id) }));
        },

        /** Returns an error message (shown on the setup screen) or null on success. */
        startMatch(p1DeckId: string, p2DeckId: string, difficulty: Difficulty): string | null {
          const decks = allDecks(get().customDecks);
          const p1 = decks.find((d) => d.id === p1DeckId);
          const p2 = decks.find((d) => d.id === p2DeckId);
          if (!p1 || !p2) {
            return 'Pick a deck for both seats.';
          }
          const config: GameConfig = {
            players: {
              p1: { deck: { leaderId: p1.leaderId, cardIds: p1.cardIds } },
              p2: { deck: { leaderId: p2.leaderId, cardIds: p2.cardIds } },
            },
          };
          try {
            const mode = get().setupMode;
            set({ screen: 'game', session: newSession(mode, difficulty, config) });
            scheduleAiIfNeeded();
            return null;
          } catch (error) {
            if (error instanceof GwentError) {
              return error.message;
            }
            throw error;
          }
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
          if (next.phase === 'play' && next.round === prev.round) {
            for (const p of ['p1', 'p2'] as const) {
              const wasOwnPass = move.type === 'PASS' && move.player === p;
              if (!prev.players[p].passed && next.players[p].passed && !wasOwnPass) {
                notes.push(`${playerLabel(next, p)} has no cards left — passed automatically.`);
              }
            }
          }
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
      };
    },
    {
      name: 'gwent-app',
      storage: createJSONStorage(() => AsyncStorage),
      // Decks, prefs and the reconnect pointer persist; sessions are ephemeral.
      partialize: (s) => ({
        customDecks: s.customDecks,
        lastOnlineGame: s.lastOnlineGame,
        prefs: s.prefs,
      }),
      // Merge persisted prefs over defaults so new keys aren't undefined.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppStore>;
        return {
          ...current,
          ...saved,
          prefs: { ...DEFAULT_PREFS, ...(saved.prefs ?? {}) },
        };
      },
    },
  ),
);
