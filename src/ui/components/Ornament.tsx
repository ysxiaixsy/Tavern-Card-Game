/**
 * Brass ornament details: corner flourishes for panels/sheets, a rune divider
 * for section headers, and a SectionLabel that bundles label + divider.
 * Rune glyphs are ORIGINAL angular geometry (Futhark-flavored, deliberately
 * not CDPR's iconography).
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '../tokens';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Corner flourishes
// ---------------------------------------------------------------------------

function Corner({ size, tint }: { size: number; tint: string }): React.JSX.Element {
  // An L-bracket with a small diamond stud at the elbow (top-left oriented).
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 16 16">
      <Path
        d="M1 9 L1 1 L9 1"
        stroke={tint}
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="square"
      />
      <Path d="M3.5 1 L1 3.5 L-1.5 1 L1 -1.5 Z" fill={tint} transform="translate(0.6,0.6) scale(0.9)" />
    </Svg>
  );
}

/** Four thin brass corner brackets, absolutely positioned inside a surface. */
export function CornerFlourishes({
  inset = 3,
  size = 13,
  opacity = 0.55,
}: {
  inset?: number;
  size?: number;
  opacity?: number;
}): React.JSX.Element {
  const tint = color.edgeBrass;
  const corner = (rotate: string, pos: ViewStyle): React.JSX.Element => (
    <View pointerEvents="none" style={[styles.corner, pos, { opacity, transform: [{ rotate }] }]}>
      <Corner size={size} tint={tint} />
    </View>
  );
  return (
    <>
      {corner('0deg', { top: inset, left: inset })}
      {corner('90deg', { top: inset, right: inset })}
      {corner('270deg', { bottom: inset, left: inset })}
      {corner('180deg', { bottom: inset, right: inset })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rune divider
// ---------------------------------------------------------------------------

/** Original angular glyphs in an 8×12 box (stroke paths). */
const RUNES = [
  'M2 12 L2 0 M2 3 L7 1 M2 8 L7 6', // twin branches
  'M1 12 L1 0 L7 6 L1 8', // banner
  'M1 12 L4 0 L7 12 M2.5 7 L5.5 7', // peak
  'M1 0 L1 12 M7 0 L7 12 M1 2 L7 10', // gate
  'M4 0 L4 12 M1 3 L4 6 L7 3', // arrow
];

/** A brass rule with rune glyphs at its center — the section-header divider. */
export function RuneDivider({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const tint = color.edgeBrass;
  return (
    <View pointerEvents="none" style={[styles.dividerRow, style]}>
      <View style={[styles.rule, { backgroundColor: tint }]} />
      <Svg width={RUNES.length * 12} height={12} viewBox={`0 0 ${RUNES.length * 10} 12`} opacity={0.75}>
        {RUNES.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={tint}
            strokeWidth={1.1}
            fill="none"
            strokeLinecap="square"
            transform={`translate(${i * 10 + 1},0) scale(0.9)`}
          />
        ))}
      </Svg>
      <View style={[styles.rule, { backgroundColor: tint }]} />
    </View>
  );
}

/** Caps label with the rune divider beneath — the app's section header. */
export function SectionLabel({
  children,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return (
    <View style={style}>
      <Text variant="label" tone="dim" caps style={textStyle}>
        {children}
      </Text>
      <RuneDivider style={styles.labelDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  labelDivider: {
    marginTop: 3,
  },
});
