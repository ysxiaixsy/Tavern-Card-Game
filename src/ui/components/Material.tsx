/**
 * Material helpers: TiledSurface wraps ImageBackground with a repeating
 * texture tile clipped to a border radius, and Sheen paints a subtle vertical
 * SVG gradient (brass / wax) under a button's label. Together they replace
 * the app's flat surface fills.
 */

import React from 'react';
import { ImageBackground, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TEXTURE } from '../textures';

export type TextureName = keyof typeof TEXTURE;

interface TiledProps {
  texture: TextureName;
  /** Solid fallback under the tile (kept while the image decodes). */
  fallback?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/** A surface filled with a repeating material tile (clip radius via style). */
export function TiledSurface({
  texture,
  fallback,
  style,
  children,
  pointerEvents,
}: TiledProps): React.JSX.Element {
  return (
    <ImageBackground
      source={TEXTURE[texture]}
      resizeMode="repeat"
      style={[
        fallback !== undefined && { backgroundColor: fallback },
        pointerEvents !== undefined && { pointerEvents },
        styles.clip,
        style,
      ]}
    >
      {children}
    </ImageBackground>
  );
}

/** Vertical two-tone sheen (light → dark) for button fills. */
export function Sheen({ top, bottom }: { top: string; bottom: string }): React.JSX.Element {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.45" stopColor={top} stopOpacity="0.35" />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheen)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
