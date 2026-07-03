/**
 * Player info strip: name/faction, gems, hand & deck counts, graveyard button,
 * leader chip, PASSED badge. Used for both seats. Faction frame down the edge.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import type { SideView } from '../../engine/types';
import { border, color, faction as factionTokens, space } from '../tokens';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { TiledSurface } from './Material';
import { Text } from './Text';

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
    <View style={styles.gems}>
      <Icon name="gem" size={11} color={count >= 1 ? color.sealRedBright : color.line} />
      <Icon name="gem" size={11} color={count >= 2 ? color.sealRedBright : color.line} />
    </View>
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
  const faction = factionTokens[side.faction];
  const leaderName = getCardDef(side.leader.defId).name.split(',')[0];
  return (
    <TiledSurface texture="oakMid" fallback={color.surface} style={[styles.strip, { borderColor: faction.frame }]}>
      <View style={styles.left}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" color={faction.accent} numberOfLines={1}>
            {name}
          </Text>
          {side.passed && (
            <Text variant="caption" tone="accent" caps>
              Passed
            </Text>
          )}
        </View>
        <View style={styles.counts}>
          <Gems count={side.gems} />
          {handCount !== undefined && (
            <>
              <Icon name="hand" size={12} color={color.inkDim} />
              <Text variant="caption" tone="dim">
                {handCount}
              </Text>
            </>
          )}
          <Icon name="deck" size={12} color={color.inkDim} />
          <Text variant="caption" tone="dim">
            {side.deckCount}
          </Text>
        </View>
      </View>
      <Chip onPress={onGraveyard}>
        <Icon name="grave" size={13} color={color.inkDim} />
        <Text variant="caption" tone="dim">
          {side.graveyard.length}
        </Text>
      </Chip>
      <Chip onPress={onLeader} active={leaderUsable} spent={side.leaderUsed}>
        <Icon name="crown" size={13} color={leaderUsable ? color.accentBright : color.inkDim} />
        <Text variant="caption" tone={leaderUsable ? 'accentBright' : 'ink'} numberOfLines={1}>
          {leaderName}
        </Text>
      </Chip>
    </TiledSurface>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderLeftWidth: border.bold,
  },
  left: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  counts: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  gems: { flexDirection: 'row', gap: 1, marginRight: space.xs },
});

export const PlayerStrip = React.memo(PlayerStripInner);
