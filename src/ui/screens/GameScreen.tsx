/**
 * The battle screen, portrait, top to bottom exactly per the brief:
 * opponent strip → opponent siege/ranged/melee → weather strip → your
 * melee/ranged/siege → totals → hand carousel → Pass (with confirmation).
 *
 * BattleScreen is purely presentational over a PlayerView — the hot-seat /
 * vs-AI wrapper (GameScreen) feeds it from the local store, while online
 * play feeds it server-fetched views. All play options derive from
 * view.legalMoves; the UI never re-implements rules.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getView } from '../../engine/view';
import type { Move, PlayerView, RowKind } from '../../engine/types';
import { factionTheme, sp } from '../theme';
import { color, radius } from '../tokens';
import { useAppStore } from '../store';
import { feedback } from '../feedback';
import { Appear, Pulse } from '../components/anim';
import { BoardRow } from '../components/BoardRow';
import { Button } from '../components/Button';
import { HandBar } from '../components/HandBar';
import { Icon } from '../components/Icon';
import { PlayerStrip } from '../components/PlayerStrip';
import { Text } from '../components/Text';
import {
  CardZoomSheet,
  ChooseFirstSheet,
  GraveyardSheet,
  LeaderSheet,
  MedicSheet,
} from '../components/Sheets';

const OPPONENT_ROW_ORDER: readonly RowKind[] = ['siege', 'ranged', 'melee'];
const YOUR_ROW_ORDER: readonly RowKind[] = ['melee', 'ranged', 'siege'];

interface Targeting {
  cardInstanceId: string;
  targets: ReadonlyMap<string, Move>;
}

export interface BattleScreenProps {
  view: PlayerView;
  notice: string | null;
  headerText: string;
  yourName: string;
  opponentName: string;
  onMove: (move: Move) => void;
  onQuit: () => void;
  quitPrompt: string;
}

export function BattleScreen({
  view,
  notice,
  headerText,
  yourName,
  opponentName,
  onMove,
  onQuit,
  quitPrompt,
}: BattleScreenProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);
  const [graveyardSide, setGraveyardSide] = useState<'you' | 'opponent' | null>(null);
  const [leaderSide, setLeaderSide] = useState<'you' | 'opponent' | null>(null);
  const confirmPassPref = useAppStore((s) => s.prefs.confirmPass);

  // Haptics on round / match results, fired once per new result.
  const roundsSeen = useRef(view.roundHistory.length);
  const matchDone = useRef(view.result !== null);
  useEffect(() => {
    if (view.roundHistory.length > roundsSeen.current) {
      const r = view.roundHistory[view.roundHistory.length - 1];
      if (r.winner === view.player) {
        feedback.success();
      } else if (r.winner === null) {
        feedback.warning();
      } else {
        feedback.warning();
      }
      roundsSeen.current = view.roundHistory.length;
    }
    if (view.result !== null && !matchDone.current) {
      matchDone.current = true;
      if (view.result.winner === view.player) {
        feedback.success();
      }
    }
  }, [view]);

  const myAction = view.legalMoves.length > 0;
  const canPass = view.legalMoves.some((m) => m.type === 'PASS');
  const weatherForRow = (rowKind: RowKind): boolean =>
    view.weather.kinds.some(
      (k) =>
        (k === 'frost' && rowKind === 'melee') ||
        (k === 'fog' && rowKind === 'ranged') ||
        (k === 'rain' && rowKind === 'siege') ||
        (k === 'storm' && (rowKind === 'ranged' || rowKind === 'siege')),
    );

  const submit = (move: Move): void => {
    setSelectedId(null);
    setTargeting(null);
    setLeaderSide(null);
    if (move.type === 'PASS') {
      feedback.pass();
    } else if (move.type === 'PLAY_CARD' || move.type === 'USE_LEADER' || move.type === 'RESOLVE_MEDIC') {
      feedback.play();
    }
    onMove(move);
  };

  const doPass = (): void => submit({ type: 'PASS', player: view.player });

  const confirmPass = (): void => {
    if (!confirmPassPref) {
      doPass();
      return;
    }
    Alert.alert('Pass this round?', 'After passing you take no further actions until the round ends.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Pass', style: 'destructive', onPress: doPass },
    ]);
  };

  const confirmQuit = (): void => {
    Alert.alert('Leave the match?', quitPrompt, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onQuit },
    ]);
  };

  const youLead = view.you.total > view.opponent.total;
  const oppLead = view.opponent.total > view.you.total;

  return (
    <View style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Text variant="caption" tone="dim">
          {headerText}
        </Text>
        <Pressable onPress={confirmQuit} hitSlop={8}>
          <Icon name="close" size={18} color={color.inkDim} />
        </Pressable>
      </View>
      {notice !== null && (
        <Appear key={notice} distance={0}>
          <Text variant="label" tone="onAccent" caps style={styles.notice}>
            {notice}
          </Text>
        </Appear>
      )}

      <PlayerStrip
        side={view.opponent}
        name={opponentName}
        handCount={view.opponent.handCount}
        onGraveyard={() => setGraveyardSide('opponent')}
        onLeader={() => setLeaderSide('opponent')}
      />

      <ScrollView style={styles.board} contentContainerStyle={{ paddingBottom: sp(1) }}>
        {OPPONENT_ROW_ORDER.map((rowKind) => (
          <BoardRow
            key={`opp-${rowKind}`}
            row={view.opponent.rows[rowKind]}
            rowKind={rowKind}
            underWeather={weatherForRow(rowKind)}
            onUnitLongPress={setZoomDefId}
          />
        ))}

        <View style={styles.weatherStrip}>
          {view.weather.kinds.length === 0 ? (
            <Text variant="caption" tone="dim">
              clear skies
            </Text>
          ) : (
            <View style={styles.weatherIcons}>
              {view.weather.kinds.map((k) => (
                <Icon key={k} name={k} size={16} color={color.debuff} />
              ))}
            </View>
          )}
        </View>

        {YOUR_ROW_ORDER.map((rowKind) => (
          <BoardRow
            key={`you-${rowKind}`}
            row={view.you.rows[rowKind]}
            rowKind={rowKind}
            underWeather={weatherForRow(rowKind)}
            targetIds={
              targeting
                ? new Set(
                    [...targeting.targets.keys()].filter((id) =>
                      view.you.rows[rowKind].units.some((u) => u.instanceId === id),
                    ),
                  )
                : undefined
            }
            onUnitPress={
              targeting
                ? (id) => {
                    const move = targeting.targets.get(id);
                    if (move) {
                      submit(move);
                    }
                  }
                : undefined
            }
            onUnitLongPress={setZoomDefId}
          />
        ))}
      </ScrollView>

      {/* totals / targeting bar */}
      {targeting ? (
        <View style={styles.totalsBar}>
          <Text variant="label" tone="accentBright" caps>
            Tap a gold-framed unit
          </Text>
          <Pressable onPress={() => setTargeting(null)} style={styles.cancelBtn} hitSlop={6}>
            <Text variant="caption">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.totalsBar}>
          <Text variant="label" tone={youLead ? 'accentBright' : 'dim'} caps>
            You
          </Text>
          <Pulse trigger={view.you.total}>
            <Text variant="numeral" color={youLead ? color.accentBright : color.ink} style={styles.score}>
              {view.you.total}
            </Text>
          </Pulse>
          <Text variant="label" tone="dim">
            vs
          </Text>
          <Pulse trigger={view.opponent.total}>
            <Text variant="numeral" color={oppLead ? color.accentBright : color.ink} style={styles.score}>
              {view.opponent.total}
            </Text>
          </Pulse>
          <Text variant="label" tone={oppLead ? 'accentBright' : 'dim'} caps>
            Foe
          </Text>
        </View>
      )}

      <PlayerStrip
        side={view.you}
        name={yourName}
        leaderUsable={view.legalMoves.some((m) => m.type === 'USE_LEADER')}
        onGraveyard={() => setGraveyardSide('you')}
        onLeader={() => setLeaderSide('you')}
      />

      <HandBar
        view={view}
        myAction={myAction}
        selectedId={selectedId}
        onSelect={(id) => {
          if (id !== null) {
            feedback.tap();
          }
          setSelectedId(id);
        }}
        onSubmit={submit}
        onEnterTargeting={(cardInstanceId, targets) => setTargeting({ cardInstanceId, targets })}
        onZoom={setZoomDefId}
      />

      <Button
        variant="danger"
        label={canPass ? 'Pass' : view.you.passed ? 'Passed' : '…'}
        disabled={!canPass}
        onPress={confirmPass}
        style={styles.passButton}
      />

      {/* sheets */}
      <CardZoomSheet defId={zoomDefId} onClose={() => setZoomDefId(null)} />
      <GraveyardSheet
        visible={graveyardSide !== null}
        title={
          graveyardSide === 'you' ? 'Your graveyard (public)' : 'Opponent graveyard (public)'
        }
        cards={graveyardSide === 'opponent' ? view.opponent.graveyard : view.you.graveyard}
        onClose={() => setGraveyardSide(null)}
      />
      <MedicSheet view={view} onSubmit={submit} />
      <LeaderSheet
        visible={leaderSide !== null}
        view={view}
        side={leaderSide ?? 'you'}
        onSubmit={submit}
        onClose={() => setLeaderSide(null)}
      />
      <ChooseFirstSheet view={view} onSubmit={submit} />
    </View>
  );
}

/** Store-connected wrapper for hot-seat and vs-AI sessions. */
export function GameScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const dispatchMove = useAppStore((s) => s.dispatchMove);
  const quitToHome = useAppStore((s) => s.quitToHome);

  const view: PlayerView | null = useMemo(
    () => (session ? getView(session.state, session.viewer) : null),
    [session],
  );
  if (session === null || view === null) {
    return null;
  }

  const seatName = (seat: 'you' | 'opponent'): string => {
    const sideView = seat === 'you' ? view.you : view.opponent;
    const playerNo = (seat === 'you') === (view.player === 'p1') ? 'Player 1' : 'Player 2';
    return `${playerNo} (${factionTheme[sideView.faction].label})`;
  };

  const aiThinking =
    session.mode === 'ai' && view.legalMoves.length === 0 && view.result === null;

  return (
    <BattleScreen
      view={view}
      notice={session.notice}
      headerText={`Round ${Math.max(view.round, 1)} · ${seatName('you')}${aiThinking ? '  ·  thinking…' : ''}`}
      yourName={seatName('you')}
      opponentName={session.mode === 'ai' ? `AI (${factionTheme[view.opponent.faction].label})` : seatName('opponent')}
      onMove={dispatchMove}
      onQuit={quitToHome}
      quitPrompt="The local game will be lost."
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp(3),
    paddingVertical: sp(1),
  },
  notice: {
    backgroundColor: color.accent,
    paddingHorizontal: sp(3),
    paddingVertical: sp(1),
    textAlign: 'center',
  },
  board: {
    flex: 1,
  },
  weatherStrip: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  weatherIcons: {
    flexDirection: 'row',
    gap: sp(2),
  },
  totalsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp(3),
    paddingVertical: sp(1),
    backgroundColor: color.surface,
  },
  score: {
    fontSize: 20,
  },
  cancelBtn: {
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: sp(3),
    paddingVertical: 2,
  },
  passButton: {
    marginHorizontal: sp(2),
    marginBottom: sp(2),
  },
});
