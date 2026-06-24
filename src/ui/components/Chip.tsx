/**
 * Small framed chip — counts, leader, graveyard, toggles. Formalizes the
 * surfaceRaised + line-border pills used in PlayerStrip / DeckBuilder / Settings.
 * `active` gives the brass-ready outline; `spent` dims it.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { border, color, radius, space, state } from '../tokens';

interface Props {
  onPress?: () => void;
  active?: boolean; // ready / selected → brass outline
  spent?: boolean; // used / disabled-look → dimmed
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function Chip({ onPress, active, spent, style, children }: Props): React.JSX.Element {
  const body = (
    <View
      style={[
        styles.chip,
        active && { borderColor: color.accentBright },
        spent && state.disabled,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) {
    return body;
  }
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => pressed && state.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: color.line,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  } as ViewStyle,
});
