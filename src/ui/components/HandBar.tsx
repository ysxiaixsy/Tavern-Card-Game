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
import type { CardInstance, Move, PlayCardMove, PlayerView } from '../../engine/types';
import { getCardDef } from '../../engine/data/cards';
import { CARD_SIZE, sp } from '../theme';
import { color, radius } from '../tokens';
import { Button } from './Button';
import { CardView } from './CardView';
import { ScrollHint, useScrollHint } from './ScrollHint';
import { Text } from './Text';

interface Props {
  view: PlayerView;
  myAction: boolean;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onSubmit: (move: Move) => void;
  onEnterTargeting: (cardInstanceId: string, targets: ReadonlyMap<string, Move>) => void;
  /** Multi-row card (agile/horn/mardroeme): highlight rows to tap. Keyed `${side}:${row}`. */
  onEnterRowChoice: (cardInstanceId: string, rows: ReadonlyMap<string, Move>) => void;
  /** Drag lifecycle (drag a card onto a board row). Window coords are the card's top-left. */
  onCardDragStart: (cardInstanceId: string) => void;
  onCardDragMove: (winX: number, winY: number) => void;
  onCardDragEnd: () => void;
  onZoom: (defId: string) => void;
}

interface DragState {
  instanceId: string;
  defId: string;
}

/** A hand card: tap to select, or drag up onto its target to play. Info is the
 * popup's View button — no long-press. */
function DraggableHandCard({
  card,
  selected,
  playable,
  hidden,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  card: CardInstance;
  selected: boolean;
  playable: boolean;
  hidden: boolean;
  onTap: () => void;
  onDragStart: (instanceId: string, defId: string, winX: number, winY: number) => void;
  onDragMove: (dx: number, dy: number, pageX: number, pageY: number) => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  const ref = useRef<View>(null);
  const latest = useRef({ playable });
  latest.current = { playable };

  const wantsDrag = (_e: unknown, g: { dx: number; dy: number }): boolean =>
    latest.current.playable && g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // taps/long-press pass through
      // Capture the vertical drag even though the child CardView Pressable is
      // the touch responder — otherwise the drag would never start.
      onMoveShouldSetPanResponderCapture: wantsDrag,
      onMoveShouldSetPanResponder: wantsDrag,
      onPanResponderGrant: () => {
        ref.current?.measureInWindow((x, y) => onDragStart(card.instanceId, card.defId, x, y));
      },
      onPanResponderMove: (e, g) => onDragMove(g.dx, g.dy, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => onDragEnd(),
      onPanResponderTerminate: () => onDragEnd(),
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
  onEnterRowChoice,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  onZoom,
}: Props): React.JSX.Element {
  const [drag, setDrag] = useState<DragState | null>(null);
  const { scrollProps, metrics } = useScrollHint();

  const handRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const base = useRef({ x: 0, y: 0 });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Bridge to the parent's live drag handlers so the per-card PanResponder
  // (created once) always calls the current closures.
  const dragApi = useRef({ start: onCardDragStart, move: onCardDragMove, end: onCardDragEnd });
  dragApi.current = { start: onCardDragStart, move: onCardDragMove, end: onCardDragEnd };

  const playsFor = (instanceId: string): PlayCardMove[] =>
    view.legalMoves.filter(
      (m): m is PlayCardMove => m.type === 'PLAY_CARD' && m.cardInstanceId === instanceId,
    );

  /** "Play" button: commit a single play, or start the right guided choice. */
  const play = (instanceId: string): void => {
    const plays = playsFor(instanceId);
    if (plays.length === 0) {
      return;
    }
    if (plays.every((m) => m.targetInstanceId !== undefined)) {
      const map = new Map<string, Move>();
      for (const m of plays) {
        map.set(m.targetInstanceId as string, m);
      }
      onEnterTargeting(instanceId, map); // decoy
      return;
    }
    if (plays.length === 1) {
      onSubmit(plays[0]); // fixed-row unit, weather, scorch, single-row horn…
      return;
    }
    // Multiple row options (agile / horn / mardroeme): highlight rows to tap.
    const card = view.you.hand.find((c) => c.instanceId === instanceId);
    const side = card && getCardDef(card.defId).abilities.includes('spy') ? 'opponent' : 'you';
    const rows = new Map<string, Move>();
    for (const m of plays) {
      if (m.row) {
        rows.set(`${side}:${m.row}`, m);
      }
    }
    onEnterRowChoice(instanceId, rows);
  };

  // --- drag wiring (the dragged card is rendered as the overlay below; the
  // parent decides which row it lands on and plays it) ---
  const onDragStart = (instanceId: string, defId: string, winX: number, winY: number): void => {
    base.current = { x: winX - origin.current.x, y: winY - origin.current.y };
    pos.setValue(base.current);
    scale.setValue(1);
    setDrag({ instanceId, defId });
    dragApi.current.start(instanceId);
  };

  const onDragMove = (dx: number, dy: number, pageX: number, pageY: number): void => {
    pos.setValue({ x: base.current.x + dx, y: base.current.y + dy });
    scale.setValue(1 + Math.min(0.15, Math.max(0, -dy / 160)));
    // Report the live touch point (window coords) for drop hit-testing.
    dragApi.current.move(pageX, pageY);
  };

  const onDragEnd = (): void => {
    setDrag(null);
    dragApi.current.end();
  };

  // --- action bar (tap flow): View + Play, hidden while dragging ---
  const selectedCard = selectedId !== null ? view.you.hand.find((c) => c.instanceId === selectedId) : undefined;
  const selectedPlays = selectedId !== null ? playsFor(selectedId) : [];

  let actionBar: React.JSX.Element | null = null;
  if (drag === null && selectedId !== null && selectedCard) {
    actionBar = (
      <View style={styles.actionRow}>
        <Button label="View" variant="ghost" onPress={() => onZoom(selectedCard.defId)} />
        {myAction && selectedPlays.length > 0 ? (
          <Button label="Play" onPress={() => play(selectedId)} />
        ) : myAction ? (
          <Text variant="caption" tone="dim" style={styles.hint}>
            No legal play
          </Text>
        ) : null}
      </View>
    );
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
        {...scrollProps}
      >
        {view.you.hand.map((card) => (
          <DraggableHandCard
            key={card.instanceId}
            card={card}
            selected={card.instanceId === selectedId}
            playable={myAction}
            hidden={drag?.instanceId === card.instanceId}
            onTap={() => onSelect(card.instanceId === selectedId ? null : card.instanceId)}
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
      <ScrollHint metrics={metrics} />

      {drag !== null && (
        <View pointerEvents="none" style={styles.hintOverlay}>
          <Text variant="label" tone="accentBright" caps style={styles.dragHint}>
            Drop on a highlighted row
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
