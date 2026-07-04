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
  TextInput,
  View,
} from 'react-native';
import type { Move, PlayerView } from '../../engine/types';
import { factionTheme } from '../theme';
import { border, color, radius, sp } from '../tokens';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { DeckPicker } from '../components/DeckPicker';
import { TiledSurface } from '../components/Material';
import { SectionLabel } from '../components/Ornament';
import { Text } from '../components/Text';
import {
  allDecks,
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
        <Text variant="title" tone="accentBright" style={styles.center}>
          Online play is not configured
        </Text>
        <Text variant="caption" tone="dim" style={styles.center}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart the
          dev server.
        </Text>
        <Button label="Back" variant="ghost" onPress={goHome} style={styles.action} />
      </Centered>
    );
  }

  if (phase.kind === 'busy') {
    return (
      <Centered>
        <ActivityIndicator color={color.accent} size="large" />
        <Text variant="caption" tone="dim" style={styles.center}>
          {phase.message}
        </Text>
      </Centered>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Centered>
        <Text variant="title" tone="accentBright" style={styles.center}>
          {phase.message}
        </Text>
        <Button label="Back to lobby" onPress={() => setPhase({ kind: 'menu' })} style={styles.action} />
        <Button label="Home" variant="ghost" onPress={leave} style={styles.action} />
      </Centered>
    );
  }

  if (phase.kind === 'waiting') {
    return (
      <Centered>
        <Text variant="label" tone="dim" caps>
          Room code
        </Text>
        <Text variant="display" tone="accentBright" style={styles.roomCode}>
          {phase.roomCode}
        </Text>
        <Text variant="caption" tone="dim" style={styles.center}>
          Share this code. The match starts the moment your opponent joins.
        </Text>
        <ActivityIndicator color={color.accent} />
        <Button
          label="Cancel room"
          variant="ghost"
          onPress={() => {
            // Best-effort: tear the room down server-side, then go home.
            void cancelRoom(phase.gameId).catch(() => undefined);
            setLastOnlineGame(null);
            leave();
          }}
          style={styles.action}
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
          <Text variant="title" tone="accentBright" style={styles.center}>
            {view.result.winner === null ? 'A draw' : won ? 'You win' : 'Defeat'}
          </Text>
          {view.roundHistory.map((r) => (
            <Text key={r.round} variant="caption" tone="dim" style={styles.center}>
              Round {r.round}: {r.totals.p1} – {r.totals.p2}
            </Text>
          ))}
          <Button
            label="Back to the tavern"
            onPress={() => {
              setLastOnlineGame(null);
              leave();
            }}
            style={styles.action}
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
          waitingForOpponent ? '  ·  opponent…' : ''
        }${submitting ? '  ·  sending…' : ''}`}
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
        <Pressable onPress={leave} hitSlop={10} style={styles.backRow}>
          <Icon name="back" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Home
          </Text>
        </Pressable>
        <Text variant="heading" tone="accentBright">
          Online — room codes
        </Text>
        <View style={styles.backRow} />
      </View>

      {lastOnlineGame !== null && (
        <Button label={`Resume game (${lastOnlineGame.roomCode})`} onPress={() => void handleResume()} />
      )}

      <SectionLabel style={styles.sectionLabel}>Your deck</SectionLabel>
      <DeckPicker decks={decks} selectedId={deckId} onSelect={setDeckId} />

      <Button label="Create a room" onPress={() => void handleCreate()} />

      <SectionLabel style={styles.sectionLabel}>Or join a friend</SectionLabel>
      <TiledSurface texture="leather" fallback={color.surface} style={styles.codeInputWrap}>
        <TextInput
          value={joinCode}
          onChangeText={(t) => setJoinCode(t.toUpperCase())}
          placeholder="ROOM CODE"
          placeholderTextColor={color.inkDim}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={styles.codeInput}
        />
      </TiledSurface>
      <Button label="Join room" onPress={() => void handleJoin()} />

      {notice !== null && (
        <Text variant="caption" color={color.sealRedBright} style={styles.center}>
          {notice}
        </Text>
      )}
      <Text variant="caption" tone="dim" style={styles.center}>
        Anonymous account, this device only. Abandoned rooms expire on their own.
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={[styles.scroll, styles.centered]}>{children}</View>;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    minWidth: 64,
  },
  center: {
    textAlign: 'center',
  },
  action: {
    alignSelf: 'center',
    minWidth: 200,
  },
  sectionLabel: {
    marginTop: sp(2),
  },
  codeInputWrap: {
    borderWidth: border.thin,
    borderColor: color.line,
    borderRadius: radius.md,
  },
  codeInput: {
    color: color.accentBright,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: sp(2),
  },
  roomCode: {
    fontSize: 44,
    letterSpacing: 10,
  },
});
