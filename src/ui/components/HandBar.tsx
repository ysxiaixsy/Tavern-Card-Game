/**
 * Your hand as a horizontal carousel plus the action bar for the selected
 * card. Play options are derived ONLY from view.legalMoves — the UI never
 * re-implements card rules. Agile/horn cards offer row buttons; the decoy
 * offers "choose a target" which switches the board into targeting mode.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Move, PlayCardMove, PlayerView } from '../../engine/types';
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

export function HandBar({
  view,
  myAction,
  selectedId,
  onSelect,
  onSubmit,
  onEnterTargeting,
  onZoom,
}: Props): React.JSX.Element {
  const playMoves = view.legalMoves.filter(
    (m): m is PlayCardMove => m.type === 'PLAY_CARD' && m.cardInstanceId === selectedId,
  );
  const targeted = playMoves.filter((m) => m.targetInstanceId !== undefined);

  let actionBar: React.JSX.Element | null = null;
  if (selectedId !== null && myAction) {
    if (playMoves.length === 0) {
      actionBar = <Text style={styles.hint}>No legal play for this card right now.</Text>;
    } else if (targeted.length === playMoves.length) {
      // Decoy: every variant needs a board target.
      actionBar = (
        <Pressable
          style={styles.action}
          onPress={() => {
            const map = new Map<string, Move>();
            for (const m of targeted) {
              map.set(m.targetInstanceId as string, m);
            }
            onEnterTargeting(selectedId, map);
          }}
        >
          <Text style={styles.actionText}>Choose a target on your side →</Text>
        </Pressable>
      );
    } else {
      actionBar = (
        <View style={styles.actionRow}>
          {playMoves.map((move, i) => (
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
      {actionBar !== null && <View style={styles.actionBar}>{actionBar}</View>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hand}
      >
        {view.you.hand.map((card) => (
          <CardView
            key={card.instanceId}
            defId={card.defId}
            size="hand"
            selected={card.instanceId === selectedId}
            onPress={() => onSelect(card.instanceId === selectedId ? null : card.instanceId)}
            onLongPress={() => onZoom(card.defId)}
          />
        ))}
        {view.you.hand.length === 0 && (
          <Text style={styles.hint}>No cards left in hand.</Text>
        )}
      </ScrollView>
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
  hint: {
    color: palette.textDim,
    fontSize: 12,
    paddingVertical: sp(2),
    alignSelf: 'center',
  },
  hand: {
    gap: sp(2),
    paddingHorizontal: sp(2),
    paddingVertical: sp(2),
    alignItems: 'flex-end',
    minHeight: 122,
  },
});
