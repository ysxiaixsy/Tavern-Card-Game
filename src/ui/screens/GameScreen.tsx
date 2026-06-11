/**
 * The battle screen, portrait, top to bottom exactly per the brief:
 * opponent strip → opponent siege/ranged/melee → weather strip → your
 * melee/ranged/siege → totals → hand carousel → Pass (with confirmation).
 *
 * Interaction model: tapping a hand card selects it and the action bar offers
 * the legal plays for it (rows for agile/horn, target mode for decoy). Medic
 * revives arrive as an undismissable picker driven by state.pendingChoice.
 * Long-press anything for the zoomed view; tap either graveyard to browse.
 */

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getView } from '../../engine/view';
import type { Move, PlayerView, RowKind } from '../../engine/types';
import { playerLabel } from '../cardInfo';
import { palette, sp, weatherIcon } from '../theme';
import { useAppStore } from '../store';
import { BoardRow } from '../components/BoardRow';
import { HandBar } from '../components/HandBar';
import { PlayerStrip } from '../components/PlayerStrip';
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

export function GameScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const dispatchMove = useAppStore((s) => s.dispatchMove);
  const quitToHome = useAppStore((s) => s.quitToHome);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);
  const [graveyardSide, setGraveyardSide] = useState<'you' | 'opponent' | null>(null);
  const [leaderSide, setLeaderSide] = useState<'you' | 'opponent' | null>(null);

  const view: PlayerView | null = useMemo(
    () => (session ? getView(session.state, session.viewer) : null),
    [session],
  );
  if (session === null || view === null) {
    return null;
  }

  const myAction = view.legalMoves.length > 0;
  const canPass = view.legalMoves.some((m) => m.type === 'PASS');
  const weatherForRow = (rowKind: RowKind): boolean =>
    view.weather.kinds.some(
      (k) =>
        (k === 'frost' && rowKind === 'melee') ||
        (k === 'fog' && rowKind === 'ranged') ||
        (k === 'rain' && rowKind === 'siege'),
    );

  const submit = (move: Move): void => {
    setSelectedId(null);
    setTargeting(null);
    setLeaderSide(null);
    dispatchMove(move);
  };

  const confirmPass = (): void => {
    Alert.alert('Pass this round?', 'After passing you take no further actions until the round ends.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Pass', style: 'destructive', onPress: () => submit({ type: 'PASS', player: view.player }) },
    ]);
  };

  const confirmQuit = (): void => {
    Alert.alert('Leave the match?', 'The hot-seat game will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: quitToHome },
    ]);
  };

  const youLead = view.you.total > view.opponent.total;
  const oppLead = view.opponent.total > view.you.total;

  return (
    <View style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Round {Math.max(view.round, 1)} · {playerLabel(session.state, view.player)}
          {session.mode === 'ai' && !myAction && view.result === null ? '   🤖 thinking…' : ''}
        </Text>
        <Pressable onPress={confirmQuit} hitSlop={8}>
          <Text style={styles.quit}>✕</Text>
        </Pressable>
      </View>
      {session.notice !== null && <Text style={styles.notice}>{session.notice}</Text>}

      <PlayerStrip
        side={view.opponent}
        name={playerLabel(session.state, view.player === 'p1' ? 'p2' : 'p1')}
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
          <Text style={styles.weatherText}>
            {view.weather.kinds.length === 0
              ? '— clear skies —'
              : view.weather.kinds.map((k) => `${weatherIcon[k]}`).join('  ')}
          </Text>
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
          <Text style={styles.targetHint}>Tap a gold-framed unit…</Text>
          <Pressable onPress={() => setTargeting(null)} style={styles.cancelBtn} hitSlop={6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.totalsBar}>
          <Text style={[styles.total, youLead && styles.totalLead]}>You {view.you.total}</Text>
          <Text style={styles.totalVs}>vs</Text>
          <Text style={[styles.total, oppLead && styles.totalLead]}>
            {view.opponent.total} Opponent
          </Text>
        </View>
      )}

      <PlayerStrip
        side={view.you}
        name={playerLabel(session.state, view.player)}
        leaderUsable={view.legalMoves.some((m) => m.type === 'USE_LEADER')}
        onGraveyard={() => setGraveyardSide('you')}
        onLeader={() => setLeaderSide('you')}
      />

      <HandBar
        view={view}
        myAction={myAction}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSubmit={submit}
        onEnterTargeting={(cardInstanceId, targets) => setTargeting({ cardInstanceId, targets })}
        onZoom={setZoomDefId}
      />

      <Pressable
        onPress={confirmPass}
        disabled={!canPass}
        style={[styles.passButton, !canPass && styles.passDisabled]}
      >
        <Text style={styles.passText}>{canPass ? 'PASS' : view.you.passed ? 'PASSED' : '…'}</Text>
      </Pressable>

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp(3),
    paddingVertical: sp(1),
  },
  headerText: {
    color: palette.textDim,
    fontSize: 12,
  },
  quit: {
    color: palette.textDim,
    fontSize: 16,
  },
  notice: {
    color: '#241a12',
    backgroundColor: palette.gold,
    fontSize: 12,
    paddingHorizontal: sp(3),
    paddingVertical: sp(1),
  },
  board: {
    flex: 1,
  },
  weatherStrip: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  weatherText: {
    color: palette.textDim,
    fontSize: 13,
  },
  totalsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp(3),
    paddingVertical: sp(1),
    backgroundColor: palette.surface,
  },
  total: {
    color: palette.textDim,
    fontSize: 14,
    fontWeight: '700',
  },
  totalLead: {
    color: palette.goldBright,
  },
  totalVs: {
    color: palette.line,
    fontSize: 12,
  },
  targetHint: {
    color: palette.goldBright,
    fontSize: 13,
  },
  cancelBtn: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: sp(3),
    paddingVertical: 2,
  },
  cancelText: {
    color: palette.text,
    fontSize: 12,
  },
  passButton: {
    margin: sp(2),
    marginTop: 0,
    backgroundColor: palette.danger,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: sp(3),
  },
  passDisabled: {
    backgroundColor: palette.surfaceRaised,
  },
  passText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 2,
  },
});
