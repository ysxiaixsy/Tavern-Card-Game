/**
 * Framed surface primitive — the "tavern" material: layered oak fill, an oak
 * seam border, and an optional inset brass keyline (the frame language that
 * replaces the app's flat hairlines). `raised` lifts it with a warm shadow;
 * `sunken` is for recessed wells (board rows behind cards).
 */

import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { border, color, elevation, radius } from '../tokens';

interface Props extends ViewProps {
  tone?: 'surface' | 'raised' | 'sunken';
  raised?: boolean; // adds shadow/elevation
  keyline?: boolean; // brass inner keyline
  radius?: keyof typeof radius;
  children?: React.ReactNode;
}

export function Panel({
  tone = 'surface',
  raised,
  keyline,
  radius: r = 'md',
  style,
  children,
  ...rest
}: Props): React.JSX.Element {
  const bg =
    tone === 'raised' ? color.surfaceRaised : tone === 'sunken' ? color.surfaceSunken : color.surface;
  const rad = radius[r];
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: bg,
          borderRadius: rad,
          borderWidth: border.thin,
          borderColor: color.line,
        },
        raised && elevation.raised,
        style,
      ]}
    >
      {keyline && (
        <View
          pointerEvents="none"
          style={[styles.keyline, { borderRadius: Math.max(0, rad - 2) }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  keyline: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: border.thin,
    borderColor: color.edgeBrass,
    opacity: 0.5,
  } as ViewStyle,
});
