/**
 * Player info strip: name/faction, gems, hand & deck counts, graveyard
 * button, leader chip, PASSED badge. Used for both seats.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import type { SideView } from '../../engine/types';
import { factionTheme, GEM, palette, sp } from '../theme';

interface Props {
  side: SideView;
  name: string;
  /** Opponent strips show a hidden-hand count; your own hand is the carousel. */
  handCount?: number;
  leaderUsable?: boolean;
  onGraveyard: () => void;
  onLeader: () => void;
}

function Gems({ count }: { count: number }): React.JSX.Element {
  return (
    <Text style={styles.gems}>
      <Text style={{ color: count >= 1 ? palette.danger : palette.line }}>{GEM}</Text>
      <Text style={{ color: count >= 2 ? palette.danger : palette.line }}>{GEM}</Text>
    </Text>
  );
}

function PlayerStripInner({
  side,
  name,
  handCount,
  leaderUsable,
  onGraveyard,
  onLeader,
}: Props): React.JSX.Element {
  const faction = factionTheme[side.faction];
  const leaderName = getCardDef(side.leader.defId).name.split(',')[0];
  return (
    <View style={[styles.strip, { borderColor: faction.frame }]}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          <Text style={{ color: faction.accent }}>{name}</Text>
          {side.passed ? <Text style={styles.passed}>  PASSED</Text> : null}
        </Text>
        <Text style={styles.counts}>
          <Gems count={side.gems} />
          {handCount !== undefined ? `  ✋${handCount}` : ''}  🂠{side.deckCount}
        </Text>
      </View>
      <Pressable onPress={onGraveyard} style={styles.chip} hitSlop={6}>
        <Text style={styles.chipText}>⚰️ {side.graveyard.length}</Text>
      </Pressable>
      <Pressable
        onPress={onLeader}
        style={[styles.chip, leaderUsable && styles.leaderReady, side.leaderUsed && styles.leaderUsed]}
        hitSlop={6}
      >
        <Text style={styles.chipText} numberOfLines={1}>
          👑 {leaderName}
          {leaderUsable ? ' !' : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderLeftWidth: 3,
    backgroundColor: palette.surface,
  },
  left: {
    flex: 1,
  },
  name: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  passed: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  counts: {
    color: palette.textDim,
    fontSize: 12,
  },
  gems: {
    fontSize: 12,
    letterSpacing: 1,
  },
  chip: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: sp(2),
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: palette.line,
    maxWidth: 150,
  },
  leaderReady: {
    borderColor: palette.goldBright,
  },
  leaderUsed: {
    opacity: 0.45,
  },
  chipText: {
    color: palette.text,
    fontSize: 11,
  },
});

export const PlayerStrip = React.memo(PlayerStripInner);
