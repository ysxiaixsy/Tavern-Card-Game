/**
 * Online play (M4): room-code matchmaking over Supabase.
 *
 * The device only ever holds PlayerViews fetched from the edge function.
 * Sync: subscribe to Realtime UPDATEs on our `games` row and refetch the
 * view when `version` bumps; a slow poll plus an AppState-foreground refetch
 * cover dropped sockets (that doubles as the reconnect story).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Move, PlayerView } from '../../engine/types';
import { factionTheme, palette, sp } from '../theme';
import {
  allDecks,
  leaderShortName,
  useAppStore,
  type SavedDeck,
} from '../store';
import { feedback } from '../feedback';
import { ensureSignedIn, isOnlineConfigured, supabase } from '../../online/supabase';
import {
  cancelRoom,
  createRoom,
  fetchSnapshot,
  joinRoom,
  submitMove,
  type OnlineGameSnapshot,
} from '../../online/api';
import { BattleScreen } from './GameScreen';
import { MulliganView } from './MulliganScreen';

type Phase =
  | { kind: 'menu' }
  | { kind: 'busy'; message: string }
  | { kind: 'waiting'; gameId: string; roomCode: string }
  | { kind: 'playing'; gameId: string }
  | { kind: 'error'; message: string };

const POLL_MS = 7000;

export function OnlineScreen(): React.JSX.Element {
  const goHome = useAppStore((s) => s.goHome);
  const customDecks = useAppStore((s) => s.customDecks);
  const lastOnlineGame = useAppStore((s) => s.lastOnlineGame);
  const setLastOnlineGame = useAppStore((s) => s.setLastOnlineGame);

  const decks = allDecks(customDecks);
  const [phase, setPhase] = useState<Phase>({ kind: 'menu' });
  const [deckId, setDeckId] = useState('starter_northern_realms');
  const [joinCode, setJoinCode] = useState('');
  const [snapshot, setSnapshot] = useState<OnlineGameSnapshot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const roundsSeen = useRef(0);
  const matchDone = useRef(false);

  // ---------------------------------------------------------------------
  // Sync plumbing
  // ---------------------------------------------------------------------

  const refresh = useCallback(async (gameId: string): Promise<void> => {
    try {
      const snap = await fetchSnapshot(gameId);
      setSnapshot((prev) => {
        if (prev?.view && snap.view && snap.version < prev.version) {
          return prev; // never regress
        }
        return snap;
      });
      if (snap.status !== 'waiting') {
        setPhase((p) => (p.kind === 'waiting' ? { kind: 'playing', gameId } : p));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sync failed.');
    }
  }, []);

  const unsubscribe = useCallback((): void => {
    if (channelRef.current && supabase) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(
    (gameId: string): void => {
      if (!supabase) {
        return;
      }
      unsubscribe();
      channelRef.current = supabase
        .channel(`game-${gameId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          () => void refresh(gameId),
        )
        .subscribe();
    },
    [refresh, unsubscribe],
  );

  // Poll + foreground refetch as the safety net.
  useEffect(() => {
    const gameId =
      phase.kind === 'waiting' || phase.kind === 'playing' ? phase.gameId : null;
    if (gameId === null) {
      return;
    }
    const interval = setInterval(() => void refresh(gameId), POLL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh(gameId);
      }
    });
    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [phase, refresh]);

  useEffect(() => unsubscribe, [unsubscribe]);

  // Round-result notices, derived from view deltas.
  useEffect(() => {
    const view = snapshot?.view;
    if (!view) {
      return;
    }
    if (view.roundHistory.length > roundsSeen.current) {
      const r = view.roundHistory[view.roundHistory.length - 1];
      const mySeat = snapshot.seat;
      const outcome =
        r.winner === null
          ? 'tied — both lose a gem!'
          : r.winner === mySeat
            ? 'goes to YOU'
            : 'goes to your opponent';
      setNotice(
        `Round ${r.round} (${r.totals.p1}:${r.totals.p2}) ${outcome}` +
          `${r.tieBrokenByNilfgaard ? ' — Nilfgaard wins ties' : ''}.`,
      );
      if (r.winner === snapshot.seat) {
        feedback.success();
      } else {
        feedback.warning();
      }
    }
    roundsSeen.current = view.roundHistory.length;
    if (view.result !== null && !matchDone.current) {
      matchDone.current = true;
      if (view.result.winner === snapshot.seat) {
        feedback.success();
      } else if (view.result.winner === null) {
        feedback.warning();
      }
    }
  }, [snapshot]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  const deckFor = (id: string): SavedDeck | undefined => decks.find((d) => d.id === id);

  const handleCreate = async (): Promise<void> => {
    const deck = deckFor(deckId);
    if (!deck) {
      return;
    }
    setPhase({ kind: 'busy', message: 'Creating room…' });
    try {
      await ensureSignedIn();
      const { gameId, roomCode } = await createRoom({
        leaderId: deck.leaderId,
        cardIds: deck.cardIds,
      });
      setLastOnlineGame({ gameId, roomCode });
      roundsSeen.current = 0;
      setPhase({ kind: 'waiting', gameId, roomCode });
      subscribe(gameId);
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Failed.' });
    }
  };

  const handleJoin = async (): Promise<void> => {
    const deck = deckFor(deckId);
    const code = joinCode.trim().toUpperCase();
    if (!deck || code.length < 6) {
      setNotice('Enter the 6-character room code.');
      return;
    }
    setPhase({ kind: 'busy', message: 'Joining room…' });
    try {
      await ensureSignedIn();
      const { gameId } = await joinRoom(code, { leaderId: deck.leaderId, cardIds: deck.cardIds });
      setLastOnlineGame({ gameId, roomCode: code });
      roundsSeen.current = 0;
      setPhase({ kind: 'playing', gameId });
      subscribe(gameId);
      await refresh(gameId);
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Failed.' });
    }
  };

  const handleResume = async (): Promise<void> => {
    if (!lastOnlineGame) {
      return;
    }
    setPhase({ kind: 'busy', message: 'Reconnecting…' });
    try {
      await ensureSignedIn();
      const snap = await fetchSnapshot(lastOnlineGame.gameId);
      setSnapshot(snap);
      roundsSeen.current = snap.view?.roundHistory.length ?? 0;
      if (snap.status === 'waiting') {
        setPhase({
          kind: 'waiting',
          gameId: lastOnlineGame.gameId,
          roomCode: snap.roomCode ?? lastOnlineGame.roomCode,
        });
      } else {
        setPhase({ kind: 'playing', gameId: lastOnlineGame.gameId });
      }
      subscribe(lastOnlineGame.gameId);
    } catch (error) {
      setLastOnlineGame(null);
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Failed.' });
    }
  };

  const handleMove = async (move: Move): Promise<void> => {
    if (phase.kind !== 'playing' || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const snap = await submitMove(phase.gameId, move);
      setSnapshot(snap);
      setNotice(null);
    } catch (error) {
      feedback.error();
      setNotice(error instanceof Error ? error.message : 'Move rejected.');
      void refresh(phase.gameId);
    } finally {
      setSubmitting(false);
    }
  };

  const leave = (): void => {
    unsubscribe();
    setSnapshot(null);
    goHome();
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (!isOnlineConfigured) {
    return (
      <Centered>
        <Text style={styles.title}>Online play is not configured</Text>
        <Text style={styles.dim}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart the
          dev server.
        </Text>
        <BigButton label="Back" onPress={goHome} ghost />
      </Centered>
    );
  }

  if (phase.kind === 'busy') {
    return (
      <Centered>
        <ActivityIndicator color={palette.gold} size="large" />
        <Text style={styles.dim}>{phase.message}</Text>
      </Centered>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Centered>
        <Text style={styles.title}>⚠️ {phase.message}</Text>
        <BigButton label="Back to lobby" onPress={() => setPhase({ kind: 'menu' })} />
        <BigButton label="Home" onPress={leave} ghost />
      </Centered>
    );
  }

  if (phase.kind === 'waiting') {
    return (
      <Centered>
        <Text style={styles.dim}>ROOM CODE</Text>
        <Text style={styles.roomCode}>{phase.roomCode}</Text>
        <Text style={styles.dim}>
          Share this code. The match starts the moment your opponent joins.
        </Text>
        <ActivityIndicator color={palette.gold} />
        <BigButton
          label="Cancel room"
          onPress={() => {
            // Best-effort: tear the room down server-side, then go home.
            void cancelRoom(phase.gameId).catch(() => undefined);
            setLastOnlineGame(null);
            leave();
          }}
          ghost
        />
      </Centered>
    );
  }

  if (phase.kind === 'playing' && snapshot?.view) {
    const view: PlayerView = snapshot.view;
    const you = `You (${factionTheme[view.you.faction].label})`;
    const opp = `Opponent (${factionTheme[view.opponent.faction].label})`;

    if (view.result !== null) {
      const won = view.result.winner === snapshot.seat;
      return (
        <Centered>
          <Text style={styles.title}>
            {view.result.winner === null ? 'A draw!' : won ? '🏆 You win!' : 'Defeat.'}
          </Text>
          {view.roundHistory.map((r) => (
            <Text key={r.round} style={styles.dim}>
              Round {r.round}: {r.totals.p1} – {r.totals.p2}
            </Text>
          ))}
          <BigButton
            label="Back to the tavern"
            onPress={() => {
              setLastOnlineGame(null);
              leave();
            }}
          />
        </Centered>
      );
    }

    if (view.phase === 'mulligan') {
      return (
        <MulliganView
          view={view}
          title={you}
          waitingText={
            view.legalMoves.length === 0 ? 'Waiting for your opponent…' : null
          }
          onMove={(move) => void handleMove(move)}
        />
      );
    }

    const waitingForOpponent = view.legalMoves.length === 0;
    return (
      <BattleScreen
        view={view}
        notice={notice}
        headerText={`Round ${Math.max(view.round, 1)} · ${you}${
          waitingForOpponent ? '   ⏳ opponent…' : ''
        }${submitting ? '   ↑ sending…' : ''}`}
        yourName={you}
        opponentName={opp}
        onMove={(move) => void handleMove(move)}
        onQuit={leave}
        quitPrompt="You can resume from the online menu while the room is alive."
      />
    );
  }

  // menu
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.menu}>
      <View style={styles.header}>
        <Pressable onPress={leave} hitSlop={10}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <Text style={styles.titleSmall}>Online — room codes</Text>
        <Text style={styles.back}> </Text>
      </View>

      {lastOnlineGame !== null && (
        <BigButton label={`▶ Resume game (${lastOnlineGame.roomCode})`} onPress={() => void handleResume()} />
      )}

      <Text style={styles.sectionLabel}>YOUR DECK</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
        {decks.map((deck) => {
          const theme = factionTheme[deck.faction];
          const selected = deck.id === deckId;
          return (
            <Pressable
              key={deck.id}
              onPress={() => setDeckId(deck.id)}
              style={[
                styles.deckChip,
                { borderColor: selected ? theme.accent : palette.line },
                selected && { backgroundColor: palette.surfaceRaised },
              ]}
            >
              <Text style={[styles.deckName, { color: selected ? theme.accent : palette.text }]} numberOfLines={1}>
                {deck.name}
              </Text>
              <Text style={styles.deckMeta} numberOfLines={1}>
                👑 {leaderShortName(deck.leaderId)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <BigButton label="🏠 Create a room" onPress={() => void handleCreate()} />

      <Text style={styles.sectionLabel}>OR JOIN A FRIEND</Text>
      <TextInput
        value={joinCode}
        onChangeText={(t) => setJoinCode(t.toUpperCase())}
        placeholder="ROOM CODE"
        placeholderTextColor={palette.textDim}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={styles.codeInput}
      />
      <BigButton label="⚔️ Join room" onPress={() => void handleJoin()} />

      {notice !== null && <Text style={styles.notice}>{notice}</Text>}
      <Text style={styles.dim}>
        Anonymous account, this device only. Abandoned rooms expire on their own.
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={[styles.scroll, styles.centered]}>{children}</View>;
}

function BigButton({
  label,
  onPress,
  ghost,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.bigButton, ghost && styles.bigButtonGhost]} onPress={onPress}>
      <Text style={ghost ? styles.bigButtonGhostText : styles.bigButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(6),
    gap: sp(3),
  },
  menu: {
    padding: sp(4),
    paddingBottom: sp(10),
    gap: sp(3),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: {
    color: palette.gold,
    fontSize: 14,
    minWidth: 52,
  },
  title: {
    color: palette.goldBright,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleSmall: {
    color: palette.goldBright,
    fontSize: 16,
    fontWeight: '800',
  },
  dim: {
    color: palette.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionLabel: {
    color: palette.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: sp(2),
  },
  deckRow: {
    gap: sp(2),
    paddingRight: sp(4),
  },
  deckChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: sp(2),
    paddingHorizontal: sp(3),
    minWidth: 160,
    gap: 2,
  },
  deckName: {
    fontWeight: '800',
    fontSize: 13,
  },
  deckMeta: {
    color: palette.textDim,
    fontSize: 11,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    color: palette.goldBright,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: sp(2),
    backgroundColor: palette.surface,
  },
  roomCode: {
    color: palette.goldBright,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 10,
  },
  notice: {
    color: palette.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  bigButton: {
    backgroundColor: palette.gold,
    borderRadius: 24,
    paddingVertical: sp(3),
    paddingHorizontal: sp(6),
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  bigButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.line,
  },
  bigButtonText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 14,
  },
  bigButtonGhostText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
