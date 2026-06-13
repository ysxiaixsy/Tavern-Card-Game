/**
 * Your hand as a horizontal carousel. Two ways to play, both driven ONLY by
 * view.legalMoves (the UI never re-implements rules):
 *
 *  - Tap a card → the action bar offers its legal plays (row buttons for
 *    agile/horn, "choose a target" for decoy), exactly as before.
 *  - Drag a card upward and release → "flick to play". A card with a single
 *    unambiguous play commits immediately; a card that still needs a choice
 *    (agile row, decoy target) just selects, opening the same action bar.
 *
 * The drag is built on React Native's core PanResponder + Animated — no
 * Reanimated/worklets/Babel setup, so it runs anywhere. The lift is clamped
 * so the card never leaves the (top-padded) hand strip: no ScrollView
 * clipping, no screen-level overlay needed.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CardInstance, Move, PlayCardMove, PlayerView } from '../../engine/types';
import { getCardDef } from '../../engine/data/cards';
import { palette, rowIcon, rowLabel, sp } from '../theme';
import { CardView } from './CardView';

interface Props {
  view: PlayerView;
  myAction: boolean;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onSubmit: (move: Move) => void;
  onEnterTargeting: (cardInstanceId: string, targets: ReadonlyMap<string, Move>) => void;
  onZoom: (defId: string) => void;
}

const LIFT = 56; // how far a card rises while dragging (px)
const ARM_AT = 34; // drag up past this and release to commit

/** A hand card that can be tapped (select), long-pressed (zoom) or dragged up (play). */
function DraggableHandCard({
  card,
  selected,
  plays,
  playable,
  onTap,
  onZoom,
  onCommit,
  onChoose,
  onHint,
}: {
  card: CardInstance;
  selected: boolean;
  plays: PlayCardMove[];
  playable: boolean;
  onTap: () => void;
  onZoom: () => void;
  onCommit: (move: PlayCardMove) => void;
  onChoose: () => void;
  onHint: (text: string | null) => void;
}): React.JSX.Element {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [lifting, setLifting] = useState(false);
  const armed = useRef(false);

  // Single, choice-free play → commit on release; anything else opens the
  // existing selection flow. The PanResponder is created once, so everything
  // it touches (current hand, turn, callbacks) is read through this ref to
  // avoid stale closures.
  const latest = useRef({ plays, playable, name: getCardDef(card.defId).name, onCommit, onChoose });
  latest.current = { plays, playable, name: getCardDef(card.defId).name, onCommit, onChoose };

  const committable = (ps: PlayCardMove[]): PlayCardMove | null =>
    ps.length === 1 && ps[0].targetInstanceId === undefined && ps[0].row === undefined
      ? ps[0]
      : null;

  const settle = (): void => {
    Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6 }).start();
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    setLifting(false);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // let taps/long-press through
      onMoveShouldSetPanResponder: (_e, g) =>
        latest.current.playable &&
        latest.current.plays.length > 0 &&
        g.dy < -8 &&
        Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => setLifting(true),
      onPanResponderMove: (_e, g) => {
        const y = Math.max(-LIFT, Math.min(0, g.dy));
        offset.setValue({ x: g.dx * 0.35, y });
        scale.setValue(1 + (-y / LIFT) * 0.12);
        const nowArmed = g.dy < -ARM_AT;
        if (nowArmed !== armed.current) {
          armed.current = nowArmed;
          if (!nowArmed) {
            onHint(null);
          } else {
            onHint(
              committable(latest.current.plays)
                ? `Release to play ${latest.current.name}`
                : 'Release to choose how to play',
            );
          }
        }
      },
      onPanResponderRelease: () => {
        const fire = armed.current;
        armed.current = false;
        onHint(null);
        settle();
        if (fire) {
          const direct = committable(latest.current.plays);
          if (direct) {
            latest.current.onCommit(direct);
          } else {
            latest.current.onChoose();
          }
        }
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        onHint(null);
        settle();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        lifting && styles.lifted,
        { transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }] },
      ]}
    >
      <CardView
        defId={card.defId}
        size="hand"
        selected={selected}
        dimmed={!playable && !selected}
        onPress={onTap}
        onLongPress={onZoom}
      />
    </Animated.View>
  );
}

export function HandBar({
  view,
  myAction,
  selectedId,
  onSelect,
  onSubmit,
  onEnterTargeting,
  onZoom,
}: Props): React.JSX.Element {
  const [dragHint, setDragHint] = useState<string | null>(null);

  const playsFor = (instanceId: string): PlayCardMove[] =>
    view.legalMoves.filter(
      (m): m is PlayCardMove => m.type === 'PLAY_CARD' && m.cardInstanceId === instanceId,
    );

  const selectedPlays = selectedId !== null ? playsFor(selectedId) : [];
  const targeted = selectedPlays.filter((m) => m.targetInstanceId !== undefined);

  /** Open the right selection flow for a card that needs a choice. */
  const choose = (instanceId: string): void => {
    const plays = playsFor(instanceId);
    if (plays.length > 0 && plays.every((m) => m.targetInstanceId !== undefined)) {
      const map = new Map<string, Move>();
      for (const m of plays) {
        map.set(m.targetInstanceId as string, m);
      }
      onEnterTargeting(instanceId, map);
    } else {
      onSelect(instanceId);
    }
  };

  let actionBar: React.JSX.Element | null = null;
  if (dragHint !== null) {
    actionBar = <Text style={styles.dragHint}>↑ {dragHint}</Text>;
  } else if (selectedId !== null && myAction) {
    if (selectedPlays.length === 0) {
      actionBar = <Text style={styles.hint}>No legal play for this card right now.</Text>;
    } else if (targeted.length === selectedPlays.length) {
      actionBar = (
        <Pressable style={styles.action} onPress={() => choose(selectedId)}>
          <Text style={styles.actionText}>Choose a target on your side →</Text>
        </Pressable>
      );
    } else {
      actionBar = (
        <View style={styles.actionRow}>
          {selectedPlays.map((move, i) => (
            <Pressable key={i} style={styles.action} onPress={() => onSubmit(move)}>
              <Text style={styles.actionText}>
                {move.row ? `${rowIcon[move.row]} ${rowLabel[move.row]}` : '▶ Play'}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }
  }

  return (
    <View>
      <View style={styles.actionBar}>
        {actionBar ?? (
          myAction && view.you.hand.length > 0 ? (
            <Text style={styles.tip}>Tap a card, or drag it up to play</Text>
          ) : null
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hand}
      >
        {view.you.hand.map((card) => (
          <DraggableHandCard
            key={card.instanceId}
            card={card}
            selected={card.instanceId === selectedId}
            plays={playsFor(card.instanceId)}
            playable={myAction}
            onTap={() => onSelect(card.instanceId === selectedId ? null : card.instanceId)}
            onZoom={() => onZoom(card.defId)}
            onCommit={(move) => onSubmit(move)}
            onChoose={() => choose(card.instanceId)}
            onHint={setDragHint}
          />
        ))}
        {view.you.hand.length === 0 && <Text style={styles.hint}>No cards left in hand.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingVertical: sp(1),
  },
  actionRow: {
    flexDirection: 'row',
    gap: sp(2),
  },
  action: {
    backgroundColor: palette.gold,
    borderRadius: 16,
    paddingHorizontal: sp(4),
    paddingVertical: sp(2),
  },
  actionText: {
    color: '#241a12',
    fontWeight: '700',
    fontSize: 13,
  },
  dragHint: {
    color: palette.goldBright,
    fontSize: 13,
    fontWeight: '700',
  },
  tip: {
    color: palette.textDim,
    fontSize: 11,
  },
  hint: {
    color: palette.textDim,
    fontSize: 12,
    paddingVertical: sp(2),
    alignSelf: 'center',
  },
  lifted: {
    zIndex: 10,
    elevation: 10,
  },
  hand: {
    gap: sp(2),
    // Generous top padding so a lifted card rises into empty space instead of
    // being clipped by the ScrollView's top edge.
    paddingTop: LIFT + sp(2),
    paddingBottom: sp(2),
    paddingHorizontal: sp(2),
    alignItems: 'flex-end',
  },
});
