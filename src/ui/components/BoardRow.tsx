/**
 * One battle row: row icon + total, horn slot, units. Weather-affected rows get
 * a cold steel tint. During decoy targeting, valid units glow gold.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { RowKind, RowView } from '../../engine/types';
import { border, color, radius, space } from '../tokens';
import { Appear, Pulse } from './anim';
import { CardView } from './CardView';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ROW_ICON: Record<RowKind, IconName> = { melee: 'sword', ranged: 'bow', siege: 'tower' };

type Rect = { x: number; y: number; width: number; height: number };

interface Props {
  row: RowView;
  rowKind: RowKind;
  underWeather: boolean;
  /** Decoy targeting/drag: instanceIds that may be targeted right now. */
  targetIds?: ReadonlySet<string>;
  onUnitPress?: (instanceId: string, defId: string) => void;
  onUnitLongPress?: (defId: string) => void;
  /** Drop-target state when playing a card onto a row (tap-choose or drag). */
  dropState?: 'valid' | 'hover';
  /** Tap handler for the whole-row drop overlay (row-choose); omit for drag. */
  onDropPress?: () => void;
  /** Reports the row's on-screen rect (window coords) for drag hit-testing. */
  onMeasure?: (rect: Rect) => void;
  /** Reports each unit's on-screen rect (for decoy drag hit-testing). */
  onUnitMeasure?: (instanceId: string, rect: Rect) => void;
  /** The unit currently under a dragged decoy (drawn distinctly). */
  hoverUnitId?: string;
  /** Bump to force a re-measure (e.g. when a drag starts). */
  measureSignal?: number;
}

/** Wraps a board unit so its on-screen rect can be reported for drag targeting. */
function MeasuredUnit({
  instanceId,
  measureSignal,
  onMeasure,
  children,
}: {
  instanceId: string;
  measureSignal?: number;
  onMeasure?: (instanceId: string, rect: Rect) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = React.useRef<View>(null);
  const report = (): void => {
    if (onMeasure) {
      ref.current?.measureInWindow((x, y, width, height) => onMeasure(instanceId, { x, y, width, height }));
    }
  };
  React.useEffect(report, [measureSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View ref={ref} collapsable={false} onLayout={report}>
      {children}
    </View>
  );
}

function BoardRowInner({
  row,
  rowKind,
  underWeather,
  targetIds,
  onUnitPress,
  onUnitLongPress,
  dropState,
  onDropPress,
  onMeasure,
  onUnitMeasure,
  hoverUnitId,
  measureSignal,
}: Props): React.JSX.Element {
  const targeting = targetIds !== undefined;
  const rowRef = React.useRef<View>(null);
  const reportRect = (): void => {
    if (onMeasure) {
      rowRef.current?.measureInWindow((x, y, width, height) => onMeasure({ x, y, width, height }));
    }
  };
  React.useEffect(reportRect, [measureSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View
      ref={rowRef}
      onLayout={reportRect}
      style={[styles.row, underWeather && { backgroundColor: color.weatherTint }]}
    >
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
          const isHover = hoverUnitId === unit.instanceId;
          return (
            // Appear keyed by instanceId → only newly-played cards animate in.
            <Appear key={unit.instanceId} distance={10} duration={180}>
              <MeasuredUnit instanceId={unit.instanceId} measureSignal={measureSignal} onMeasure={onUnitMeasure}>
                <CardView
                  defId={unit.defId}
                  instanceId={unit.instanceId}
                  size="board"
                  effective={unit.effectiveStrength}
                  onField
                  highlighted={isTarget && !isHover}
                  selected={isHover}
                  dimmed={targeting && !isTarget}
                  onPress={onUnitPress ? () => onUnitPress(unit.instanceId, unit.defId) : undefined}
                  onLongPress={onUnitLongPress ? () => onUnitLongPress(unit.defId) : undefined}
                />
              </MeasuredUnit>
            </Appear>
          );
        })}
      </ScrollView>
      {dropState && (
        <Pressable
          style={[styles.dropOverlay, dropState === 'hover' && styles.dropOverlayHover]}
          pointerEvents={onDropPress ? 'auto' : 'none'}
          onPress={onDropPress}
        >
          {onDropPress && (
            <Text variant="label" tone="accentBright" caps>
              Play here
            </Text>
          )}
        </Pressable>
      )}
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
  dropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: border.frame,
    borderColor: color.accent,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(200,162,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropOverlayHover: {
    borderStyle: 'solid',
    borderColor: color.accentBright,
    backgroundColor: 'rgba(239,206,134,0.22)',
  },
});

export const BoardRow = React.memo(BoardRowInner);
