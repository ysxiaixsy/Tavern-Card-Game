/**
 * Button primitive — the existing gold-pill / ghost language, formalized.
 * Variants: primary (brass with a top-light sheen), ghost (leather inside a
 * brass outline), danger (wax-seal red sheen). Disabled = flat dark leather.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { border, color, radius, space, state } from '../tokens';
import { Sheen, TiledSurface } from './Material';
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
        ? { backgroundColor: color.accent, borderColor: color.accentDim }
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

  const label_ = (
    <View style={styles.row}>
      {icon}
      <Text variant="label" tone={tone} caps>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, fill, pressed && !disabled && state.pressed, style]}
    >
      {/* Material fill: metal sheen for solid variants, leather for ghost. */}
      {!disabled && variant === 'primary' && <Sheen top={color.accentBright} bottom={color.accentDim} />}
      {!disabled && variant === 'danger' && <Sheen top={color.sealRedBright} bottom={color.sealRed} />}
      {!disabled && variant === 'ghost' && (
        <TiledSurface texture="leather" pointerEvents="none" style={StyleSheet.absoluteFill} />
      )}
      {label_}
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
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
