/**
 * Your hand as a horizontal carousel. Two ways to play, both driven ONLY by
 * view.legalMoves (the UI never re-implements rules):
 *
 *  - Tap a card → the action bar offers its legal plays (row buttons for
 *    agile/horn, "choose a target" for decoy).
 *  - Drag a card upward and release → "flick to play". A card with a single
 *    unambiguous play commits immediately; a card that still needs a choice
 *    (agile row, decoy target) just opens the same action bar.
 *
 * Built on React Native's core PanResponder + Animated — no Reanimated /
 * worklets / Babel setup, so it runs anywhere. The card being dragged is
 * drawn as a floating OVERLAY positioned over the hand, so it can rise freely
 * without the ScrollView clipping it and without padding the hand strip (which
 * would leave a permanent gap above the cards). The in-row card just dims.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { CardInstance, Move, PlayCardMove, PlayerView, RowKind } from '../../engine/types';
import { getCardDef } from '../../engine/data/cards';
import { CARD_SIZE, rowLabel, sp } from '../theme';
import { color, radius } from '../tokens';
import { Button } from './Button';
import { CardView } from './CardView';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ROW_ICON: Record<RowKind, IconName> = { melee: 'sword', ranged: 'bow', siege: 'tower' };

interface Props {
  view: PlayerView;
  myAction: boolean;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onSubmit: (move: Move) => void;
  onEnterTargeting: (cardInstanceId: string, targets: ReadonlyMap<string, Move>) => void;
  onZoom: (defId: string) => void;
}

const ARM_AT = 38; // drag up past this and release to play

interface DragState {
  instanceId: string;
  defId: string;
}

/** A hand card: tap (select), long-press (zoom), or drag up (play). */
function DraggableHandCard({
  card,
  selected,
  playable,
  hidden,
  onTap,
  onZoom,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  card: CardInstance;
  selected: boolean;
  playable: boolean;
  hidden: boolean;
  onTap: () => void;
  onZoom: () => void;
  onDragStart: (instanceId: string, defId: string, winX: number, winY: number) => void;
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: (committed: boolean) => void;
}): React.JSX.Element {
  const ref = useRef<View>(null);
  const latest = useRef({ playable });
  latest.current = { playable };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // taps/long-press pass through
      onMoveShouldSetPanResponder: (_e, g) =>
        latest.current.playable && g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        ref.current?.measureInWindow((x, y) => onDragStart(card.instanceId, card.defId, x, y));
      },
      onPanResponderMove: (_e, g) => onDragMove(g.dx, g.dy),
      onPanResponderRelease: (_e, g) => onDragEnd(g.dy < -ARM_AT),
      onPanResponderTerminate: () => onDragEnd(false),
    }),
  ).current;

  return (
    <View ref={ref} collapsable={false} {...responder.panHandlers} style={hidden && styles.hidden}>
      <CardView
        defId={card.defId}
        instanceId={card.instanceId}
        size="hand"
        selected={selected}
        dimmed={!playable && !selected}
        onPress={onTap}
        onLongPress={onZoom}
      />
    </View>
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
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const handRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const base = useRef({ x: 0, y: 0 });
  const armed = useRef(false);
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;

  const playsFor = (instanceId: string): PlayCardMove[] =>
    view.legalMoves.filter(
      (m): m is PlayCardMove => m.type === 'PLAY_CARD' && m.cardInstanceId === instanceId,
    );

  const committable = (ps: PlayCardMove[]): PlayCardMove | null =>
    ps.length === 1 && ps[0].targetInstanceId === undefined && ps[0].row === undefined ? ps[0] : null;

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

  // --- drag wiring (the dragged card is rendered as the overlay below) ---
  const onDragStart = (instanceId: string, defId: string, winX: number, winY: number): void => {
    base.current = { x: winX - origin.current.x, y: winY - origin.current.y };
    pos.setValue(base.current);
    scale.setValue(1);
    armed.current = false;
    setHint(null);
    setDrag({ instanceId, defId });
  };

  const onDragMove = (dx: number, dy: number): void => {
    pos.setValue({ x: base.current.x + dx, y: base.current.y + dy });
    scale.setValue(1 + Math.min(0.15, Math.max(0, -dy / 160)));
    const nowArmed = dy < -ARM_AT;
    if (nowArmed !== armed.current) {
      armed.current = nowArmed;
      if (!nowArmed || !drag) {
        setHint(null);
      } else {
        const direct = committable(playsFor(drag.instanceId));
        setHint(direct ? `Release to play ${getCardDef(drag.defId).name}` : 'Release to choose how to play');
      }
    }
  };

  const onDragEnd = (committed: boolean): void => {
    const current = drag;
    setHint(null);
    setDrag(null);
    if (committed && current) {
      const direct = committable(playsFor(current.instanceId));
      if (direct) {
        onSubmit(direct);
      } else {
        choose(current.instanceId);
      }
    }
  };

  // --- action bar (tap flow) ---
  const selectedPlays = selectedId !== null ? playsFor(selectedId) : [];
  const targeted = selectedPlays.filter((m) => m.targetInstanceId !== undefined);

  // Tap-flow action bar. The drag hint is rendered separately as a
  // non-layout overlay so it can't shift the cards mid-drag.
  let actionBar: React.JSX.Element | null = null;
  if (hint === null && selectedId !== null && myAction) {
    if (selectedPlays.length === 0) {
      actionBar = (
        <Text variant="caption" tone="dim" style={styles.hint}>
          No legal play for this card right now.
        </Text>
      );
    } else if (targeted.length === selectedPlays.length) {
      actionBar = <Button label="Choose a target" onPress={() => choose(selectedId)} />;
    } else {
      actionBar = (
        <View style={styles.actionRow}>
          {selectedPlays.map((move, i) => (
            <Button
              key={i}
              label={move.row ? rowLabel[move.row] : 'Play'}
              onPress={() => onSubmit(move)}
              icon={
                move.row ? (
                  <Icon name={ROW_ICON[move.row]} size={14} color={color.inkOnAccent} />
                ) : undefined
              }
            />
          ))}
        </View>
      );
    }
  }

  const onLayout = (_e: LayoutChangeEvent): void => {
    // Measure the hand container's window origin so the overlay can be placed
    // in container-local coordinates.
    handRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  };

  return (
    <View ref={handRef} onLayout={onLayout}>
      {actionBar !== null && <View style={styles.actionBar}>{actionBar}</View>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={drag === null}
        contentContainerStyle={styles.hand}
      >
        {view.you.hand.map((card) => (
          <DraggableHandCard
            key={card.instanceId}
            card={card}
            selected={card.instanceId === selectedId}
            playable={myAction}
            hidden={drag?.instanceId === card.instanceId}
            onTap={() => onSelect(card.instanceId === selectedId ? null : card.instanceId)}
            onZoom={() => onZoom(card.defId)}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ))}
        {view.you.hand.length === 0 && (
          <Text variant="caption" tone="dim" style={styles.hint}>
            No cards left in hand.
          </Text>
        )}
      </ScrollView>

      {hint !== null && (
        <View pointerEvents="none" style={styles.hintOverlay}>
          <Text variant="label" tone="accentBright" caps style={styles.dragHint}>
            ↑ {hint}
          </Text>
        </View>
      )}

      {drag !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            {
              width: CARD_SIZE.hand.width,
              height: CARD_SIZE.hand.height,
              transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }],
            },
          ]}
        >
          <CardView defId={drag.defId} instanceId={drag.instanceId} size="hand" selected />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: 'center',
    paddingVertical: sp(1),
  },
  actionRow: {
    flexDirection: 'row',
    gap: sp(2),
  },
  hintOverlay: {
    position: 'absolute',
    top: -sp(5),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 101,
  },
  dragHint: {
    backgroundColor: color.surface,
    paddingHorizontal: sp(3),
    paddingVertical: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  hint: {
    paddingVertical: sp(2),
    alignSelf: 'center',
  },
  hidden: {
    opacity: 0,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 100,
    elevation: 100,
  },
  hand: {
    gap: sp(2),
    paddingHorizontal: sp(2),
    paddingVertical: sp(2),
    alignItems: 'flex-end',
  },
});
