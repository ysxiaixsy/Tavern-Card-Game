/**
 * The tavern table: a tiled dark-oak texture with a soft radial candlelight
 * vignette. Mounted ONCE in Root — screens keep transparent roots and the
 * wood shows through everywhere.
 */

import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TEXTURE } from '../textures';
import { color } from '../tokens';

export function ScreenBackground({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ImageBackground source={TEXTURE.oakDark} resizeMode="repeat" style={styles.fill}>
      {/* Candlelight: bright-ish center, gently darker edges (≤12%). */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="42%" rx="72%" ry="60%">
            <Stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: color.bg, // under the tile while it decodes
  },
});
