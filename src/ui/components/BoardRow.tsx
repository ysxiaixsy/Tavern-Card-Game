/**
 * One battle row: row icon + total, horn slot, units. Weather-affected rows get
 * a cold steel tint. During decoy targeting, valid units glow gold.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { RowKind, RowView } from '../../engine/types';
import { border, color, radius, space } from '../tokens';
import { Appear, Pulse } from './anim';
import { CardView } from './CardView';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ROW_ICON: Record<RowKind, IconName> = { melee: 'sword', ranged: 'bow', siege: 'tower' };

interface Props {
  row: RowView;
  rowKind: RowKind;
  underWeather: boolean;
  /** Decoy targeting: instanceIds that may be tapped right now. */
  targetIds?: ReadonlySet<string>;
  onUnitPress?: (instanceId: string) => void;
  onUnitLongPress?: (defId: string) => void;
}

function BoardRowInner({
  row,
  rowKind,
  underWeather,
  targetIds,
  onUnitPress,
  onUnitLongPress,
}: Props): React.JSX.Element {
  const targeting = targetIds !== undefined;
  return (
    <View style={[styles.row, underWeather && { backgroundColor: color.weatherTint }]}>
      <View style={styles.meta}>
        <Icon name={ROW_ICON[rowKind]} size={13} color={color.inkDim} />
        <Pulse trigger={row.total}>
          <Text variant="numeral" color={color.accent} style={styles.total}>
            {row.total}
          </Text>
        </Pulse>
      </View>
      <View style={[styles.hornSlot, row.horn !== null && styles.hornFilled]}>
        {row.horn !== null && <Icon name="horn" size={12} color={color.accent} />}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.units}
      >
        {row.units.map((unit) => {
          const isTarget = targetIds?.has(unit.instanceId) ?? false;
          return (
            // Appear keyed by instanceId → only newly-played cards animate in.
            <Appear key={unit.instanceId} distance={10} duration={180}>
              <CardView
                defId={unit.defId}
                instanceId={unit.instanceId}
                size="board"
                effective={unit.effectiveStrength}
                highlighted={isTarget}
                dimmed={targeting && !isTarget}
                onPress={onUnitPress ? () => onUnitPress(unit.instanceId) : undefined}
                onLongPress={onUnitLongPress ? () => onUnitLongPress(unit.defId) : undefined}
              />
            </Appear>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
    paddingVertical: 2,
    minHeight: 58,
  },
  meta: {
    width: 34,
    alignItems: 'center',
    gap: 1,
  },
  total: {
    fontSize: 13,
  },
  hornSlot: {
    width: 22,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: border.thin,
    borderStyle: 'dashed',
    borderColor: color.line,
    marginRight: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hornFilled: {
    borderStyle: 'solid',
    borderColor: color.accent,
    backgroundColor: color.surfaceRaised,
  },
  units: {
    gap: space.xs,
    paddingRight: space.sm,
    alignItems: 'center',
  },
});

export const BoardRow = React.memo(BoardRowInner);
