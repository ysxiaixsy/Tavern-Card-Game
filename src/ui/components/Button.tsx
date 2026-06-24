/**
 * Button primitive — the existing gold-pill / ghost language, formalized.
 * Variants: primary (gold leaf), ghost (brass outline), danger (wax-seal red).
 * Replaces the per-screen pill styles + the hardcoded `#241a12` button ink.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { border, color, radius, space, state } from '../tokens';
import { Text } from './Text';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Optional leading element (e.g. an <Icon/>). */
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function Button({ label, onPress, variant = 'primary', disabled, icon, style }: Props): React.JSX.Element {
  const fill =
    disabled
      ? { backgroundColor: color.surfaceRaised, borderColor: color.line }
      : variant === 'primary'
        ? { backgroundColor: color.accent, borderColor: color.accent }
        : variant === 'danger'
          ? { backgroundColor: color.sealRed, borderColor: color.sealRed }
          : { backgroundColor: 'transparent', borderColor: color.accent };

  const tone = disabled
    ? 'dim'
    : variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'ink'
        : 'accentBright';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, fill, pressed && !disabled && state.pressed, style]}
    >
      <View style={styles.row}>
        {icon}
        <Text variant="label" tone={tone} caps>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: border.frame,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
