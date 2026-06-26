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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getView } from '../../engine/view';
import { getCardDef } from '../../engine/data/cards';
import type { Move, PlayCardMove, PlayerView, RowKind } from '../../engine/types';
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
  Sheet,
} from '../components/Sheets';

const OPPONENT_ROW_ORDER: readonly RowKind[] = ['siege', 'ranged', 'melee'];
const YOUR_ROW_ORDER: readonly RowKind[] = ['melee', 'ranged', 'siege'];

/** How close (px) a dragged decoy must get to a unit to target it. */
const UNIT_SNAP_PX = 64;

interface Targeting {
  cardInstanceId: string;
  targets: ReadonlyMap<string, Move>;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
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
  // A target tapped but not yet confirmed (decoy). Shown as a confirm bar.
  const [pendingTarget, setPendingTarget] = useState<{ id: string; defId: string; move: Move } | null>(
    null,
  );
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);
  const [graveyardSide, setGraveyardSide] = useState<'you' | 'opponent' | null>(null);
  const [leaderSide, setLeaderSide] = useState<'you' | 'opponent' | null>(null);
  // Tap-to-play row choice (agile/horn/mardroeme): valid rows keyed `${side}:${row}`.
  const [rowChoice, setRowChoice] = useState<{ cardInstanceId: string; rows: ReadonlyMap<string, Move> } | null>(
    null,
  );
  const confirmPassPref = useAppStore((s) => s.prefs.confirmPass);
  const confirmDragPref = useAppStore((s) => s.prefs.confirmDrag);
  const seenTips = useAppStore((s) => s.prefs.seenTips);
  const setPref = useAppStore((s) => s.setPref);
  const dismissTips = (): void => setPref('seenTips', true);

  // --- drag-to-play: drag a card onto its legal row, or a decoy onto a unit ---
  // A play staged for confirmation (drag-drop with the confirm pref on).
  const [pendingPlay, setPendingPlay] = useState<{ move: Move; defId: string } | null>(null);
  const [dragRowKeys, setDragRowKeys] = useState<ReadonlySet<string> | null>(null);
  const [dragUnitIds, setDragUnitIds] = useState<ReadonlySet<string> | null>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);
  const [measureSignal, setMeasureSignal] = useState(0);
  // Live mirrors so the per-card PanResponder's stable handlers read fresh data.
  const viewRef = useRef(view);
  viewRef.current = view;
  const rowRects = useRef<Map<string, Rect>>(new Map());
  const unitRects = useRef<Map<string, Rect>>(new Map());
  const dragRowsRef = useRef<ReadonlyMap<string, PlayCardMove>>(new Map());
  const dragUnitsRef = useRef<ReadonlyMap<string, PlayCardMove>>(new Map());
  const dragHoverRef = useRef<string | null>(null);

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

  const cancelTargeting = (): void => {
    setTargeting(null);
    setPendingTarget(null);
    setRowChoice(null);
  };

  const submit = (move: Move): void => {
    setSelectedId(null);
    setTargeting(null);
    setPendingTarget(null);
    setRowChoice(null);
    setPendingPlay(null);
    setLeaderSide(null);
    if (move.type === 'PASS') {
      feedback.pass();
    } else if (move.type === 'PLAY_CARD' || move.type === 'USE_LEADER' || move.type === 'RESOLVE_MEDIC') {
      feedback.play();
    }
    onMove(move);
  };

  // Stable mirrors for the drag handlers (created once, called by the
  // per-card PanResponder).
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const confirmDragRef = useRef(confirmDragPref);
  confirmDragRef.current = confirmDragPref;

  const findUnitDefId = (instanceId: string): string => {
    const v = viewRef.current;
    for (const sideView of [v.you, v.opponent]) {
      for (const rk of ['melee', 'ranged', 'siege'] as RowKind[]) {
        const u = sideView.rows[rk].units.find((x) => x.instanceId === instanceId);
        if (u) {
          return u.defId;
        }
      }
    }
    return '';
  };

  const onCardDragStart = useCallback((cardInstanceId: string) => {
    const v = viewRef.current;
    const card = v.you.hand.find((c) => c.instanceId === cardInstanceId);
    const rows = new Map<string, PlayCardMove>();
    const units = new Map<string, PlayCardMove>();
    if (card) {
      const def = getCardDef(card.defId);
      const sideKey = def.abilities.includes('spy') ? 'opponent' : 'you';
      for (const m of v.legalMoves) {
        if (m.type !== 'PLAY_CARD' || m.cardInstanceId !== cardInstanceId) {
          continue;
        }
        if (m.targetInstanceId) {
          units.set(m.targetInstanceId, m); // decoy: per-unit target
        } else {
          // Fixed-row unit moves carry no `row` (the engine uses def.row); agile
          // moves carry an explicit row. Weather/scorch have no row → not draggable.
          const row = m.row ?? (def.row && def.row !== 'agile' ? def.row : undefined);
          if (row) {
            rows.set(`${sideKey}:${row}`, m);
          }
        }
      }
    }
    dragRowsRef.current = rows;
    dragUnitsRef.current = units;
    dragHoverRef.current = null;
    setDragRowKeys(rows.size > 0 ? new Set(rows.keys()) : null);
    setDragUnitIds(units.size > 0 ? new Set(units.keys()) : null);
    setDragHover(null);
    setMeasureSignal((n) => n + 1); // re-measure rows/units where they currently sit
  }, []);

  const onCardDragMove = useCallback((px: number, py: number) => {
    const inRect = (r: Rect | undefined): boolean =>
      !!r && px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
    // Distance from the point to the nearest edge of a rect (0 if inside).
    const distToRect = (r: Rect): number => {
      const dx = Math.max(r.x - px, 0, px - (r.x + r.width));
      const dy = Math.max(r.y - py, 0, py - (r.y + r.height));
      return Math.hypot(dx, dy);
    };
    let best: string | null = null;
    if (dragRowsRef.current.size > 0) {
      // Rows are big bands — the row under the finger.
      for (const key of dragRowsRef.current.keys()) {
        if (inRect(rowRects.current.get(key))) {
          best = key;
          break;
        }
      }
    } else if (dragUnitsRef.current.size > 0) {
      // Units are tiny — snap to the nearest valid unit within reach.
      let bestDist = Infinity;
      for (const id of dragUnitsRef.current.keys()) {
        const r = unitRects.current.get(id);
        if (!r) {
          continue;
        }
        const d = distToRect(r);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
      if (bestDist > UNIT_SNAP_PX) {
        best = null; // too far from any target → no drop
      }
    }
    if (dragHoverRef.current !== best) {
      dragHoverRef.current = best;
      setDragHover(best);
    }
  }, []);

  const onCardDragEnd = useCallback(() => {
    const key = dragHoverRef.current;
    const rowMove = key ? dragRowsRef.current.get(key) : undefined;
    const unitMove = key ? dragUnitsRef.current.get(key) : undefined;
    dragRowsRef.current = new Map();
    dragUnitsRef.current = new Map();
    dragHoverRef.current = null;
    setDragRowKeys(null);
    setDragUnitIds(null);
    setDragHover(null);
    if (unitMove && key) {
      // Decoy: confirm via the existing pending-target bar.
      setPendingTarget({ id: key, defId: findUnitDefId(key), move: unitMove });
    } else if (rowMove) {
      if (confirmDragRef.current) {
        const card = viewRef.current.you.hand.find((c) => c.instanceId === rowMove.cardInstanceId);
        setPendingPlay({ move: rowMove, defId: card?.defId ?? '' });
      } else {
        submitRef.current(rowMove);
      }
    }
    // released off any valid target → no play (illegal moves blocked)
  }, []);

  // Drop props for a board row: row-choose (tap) or live drag highlight.
  const rowProps = (
    side: 'you' | 'opponent',
    rowKind: RowKind,
  ): {
    dropState?: 'valid' | 'hover';
    onDropPress?: () => void;
    onMeasure: (rect: Rect) => void;
    measureSignal: number;
  } => {
    const key = `${side}:${rowKind}`;
    const base = {
      onMeasure: (rect: Rect) => {
        rowRects.current.set(key, rect);
      },
      measureSignal,
    };
    if (rowChoice && rowChoice.rows.has(key)) {
      return {
        ...base,
        dropState: 'valid',
        onDropPress: () => {
          const move = rowChoice.rows.get(key);
          if (move) {
            submit(move);
          }
        },
      };
    }
    if (dragRowKeys?.has(key)) {
      return { ...base, dropState: dragHover === key ? 'hover' : 'valid' };
    }
    return base;
  };

  const measureUnit = (instanceId: string, rect: Rect): void => {
    unitRects.current.set(instanceId, rect);
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
            // Single tap opens card info — suppressed while picking a target/row.
            onUnitPress={targeting || rowChoice ? undefined : (_id, defId) => setZoomDefId(defId)}
            onUnitLongPress={setZoomDefId}
            {...rowProps('opponent', rowKind)}
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
            // Decoy targets glow (tap targeting, the confirm pick, or a dragged
            // decoy); the rest dim so the choice is obvious.
            targetIds={
              targeting
                ? new Set(
                    [...targeting.targets.keys()].filter((id) => (pendingTarget ? id === pendingTarget.id : true)),
                  )
                : pendingTarget
                  ? new Set([pendingTarget.id])
                  : dragUnitIds ?? undefined
            }
            hoverUnitId={dragUnitIds ? dragHover ?? undefined : undefined}
            onUnitMeasure={measureUnit}
            // While targeting: tap a gold-framed unit to pick it (then confirm).
            // While row-choosing: the row overlay handles taps (info suppressed).
            // Otherwise a tap opens card info (targeting wins; info suppressed).
            onUnitPress={(id, defId) => {
              if (rowChoice) {
                return; // the row drop overlay drives from here
              }
              if (targeting) {
                if (pendingTarget) {
                  return; // the confirm bar drives from here
                }
                const move = targeting.targets.get(id);
                if (move) {
                  feedback.tap();
                  setPendingTarget({ id, defId, move });
                }
              } else {
                setZoomDefId(defId);
              }
            }}
            onUnitLongPress={setZoomDefId}
            {...rowProps('you', rowKind)}
          />
        ))}
      </ScrollView>

      {/* totals / targeting / row-choose / confirm bar */}
      {pendingPlay ? (
        <View style={styles.totalsBar}>
          <Text variant="label" tone="accentBright" caps>
            Play {getCardDef(pendingPlay.defId).name}?
          </Text>
          <Pressable onPress={() => setPendingPlay(null)} style={styles.cancelBtn} hitSlop={6}>
            <Text variant="caption">Cancel</Text>
          </Pressable>
          <Pressable onPress={() => submit(pendingPlay.move)} style={styles.confirmBtn} hitSlop={6}>
            <Text variant="caption" tone="onAccent" caps>
              Confirm
            </Text>
          </Pressable>
        </View>
      ) : rowChoice ? (
        <View style={styles.totalsBar}>
          <Text variant="label" tone="accentBright" caps>
            Tap a highlighted row
          </Text>
          <Pressable onPress={() => setRowChoice(null)} style={styles.cancelBtn} hitSlop={6}>
            <Text variant="caption">Cancel</Text>
          </Pressable>
        </View>
      ) : pendingTarget ? (
        <View style={styles.totalsBar}>
          <Text variant="label" tone="accentBright" caps>
            Decoy {getCardDef(pendingTarget.defId).name}?
          </Text>
          <Pressable onPress={() => setPendingTarget(null)} style={styles.cancelBtn} hitSlop={6}>
            <Text variant="caption">Cancel</Text>
          </Pressable>
          <Pressable onPress={() => submit(pendingTarget.move)} style={styles.confirmBtn} hitSlop={6}>
            <Text variant="caption" tone="onAccent" caps>
              Confirm
            </Text>
          </Pressable>
        </View>
      ) : targeting ? (
        <View style={styles.totalsBar}>
          <Text variant="label" tone="accentBright" caps>
            Tap a gold-framed unit
          </Text>
          <Pressable onPress={cancelTargeting} style={styles.cancelBtn} hitSlop={6}>
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
        handCount={view.you.hand.length}
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
          // Picking a different card abandons any in-progress row/target choice.
          cancelTargeting();
          setSelectedId(id);
        }}
        onSubmit={submit}
        onEnterTargeting={(cardInstanceId, targets) => setTargeting({ cardInstanceId, targets })}
        onEnterRowChoice={(cardInstanceId, rows) => setRowChoice({ cardInstanceId, rows })}
        onCardDragStart={onCardDragStart}
        onCardDragMove={onCardDragMove}
        onCardDragEnd={onCardDragEnd}
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

      {/* One-time quick tips on the first match. */}
      <Sheet visible={!seenTips} title="Quick tips" onClose={dismissTips}>
        <View style={styles.tips}>
          <Text variant="body">• Drag a card up onto a glowing row to play it — agile cards light up two rows.</Text>
          <Text variant="body">• Decoy and other targets: drag onto a highlighted unit.</Text>
          <Text variant="body">• Or tap a card for View (info) and Play.</Text>
          <Text variant="body">• Tap any board or graveyard card to read it. Press Pass to end your round.</Text>
          <Text variant="caption" tone="dim">
            Full rules live under “How to Play” on the home screen.
          </Text>
          <Button label="Got it" onPress={dismissTips} style={styles.tipsButton} />
        </View>
      </Sheet>
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
  confirmBtn: {
    backgroundColor: color.accent,
    borderRadius: radius.md,
    paddingHorizontal: sp(3),
    paddingVertical: 2,
  },
  passButton: {
    marginHorizontal: sp(2),
    marginBottom: sp(2),
  },
  tips: {
    gap: sp(2),
  },
  tipsButton: {
    alignSelf: 'center',
    minWidth: 160,
    marginTop: sp(1),
  },
});
