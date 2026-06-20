/**
 * One battle row: row icon + total badge, horn slot, units. Weather-affected
 * rows get a cold tint. During decoy targeting, valid units glow gold.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RowKind, RowView } from '../../engine/types';
import { palette, rowIcon, sp } from '../theme';
import { CardView } from './CardView';

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
    <View style={[styles.row, underWeather && { backgroundColor: palette.weatherTint }]}>
      <View style={styles.meta}>
        <Text style={styles.rowIcon}>{rowIcon[rowKind]}</Text>
        <Text style={styles.total}>{row.total}</Text>
      </View>
      <View style={[styles.hornSlot, row.horn !== null && styles.hornFilled]}>
        <Text style={styles.hornGlyph}>{row.horn !== null ? '📯' : ''}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.units}
      >
        {row.units.map((unit) => {
          const isTarget = targetIds?.has(unit.instanceId) ?? false;
          return (
            <CardView
              key={unit.instanceId}
              defId={unit.defId}
              instanceId={unit.instanceId}
              size="board"
              effective={unit.effectiveStrength}
              highlighted={isTarget}
              dimmed={targeting && !isTarget}
              onPress={onUnitPress ? () => onUnitPress(unit.instanceId) : undefined}
              onLongPress={onUnitLongPress ? () => onUnitLongPress(unit.defId) : undefined}
            />
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
    borderBottomColor: palette.line,
    paddingVertical: 2,
    minHeight: 58,
  },
  meta: {
    width: 34,
    alignItems: 'center',
  },
  rowIcon: {
    fontSize: 12,
  },
  total: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  hornSlot: {
    width: 22,
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.line,
    marginRight: sp(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hornFilled: {
    borderStyle: 'solid',
    borderColor: palette.gold,
    backgroundColor: palette.surfaceRaised,
  },
  hornGlyph: {
    fontSize: 12,
  },
  units: {
    gap: sp(1),
    paddingRight: sp(2),
    alignItems: 'center',
  },
});

export const BoardRow = React.memo(BoardRowInner);
