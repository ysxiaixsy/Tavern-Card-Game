/**
 * Brass ornament details: corner flourishes for panels/sheets, a geometric
 * divider for section headers, and a SectionLabel that bundles label +
 * divider. Pure ornament geometry — nothing that reads as text or borrows
 * CDPR's iconography.
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
// Ornament divider
// ---------------------------------------------------------------------------

/** A brass rule with a three-diamond stud at its center — the section-header
 * divider. Pure geometry: nothing that reads as lettering. */
export function OrnamentDivider({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const tint = color.edgeBrass;
  return (
    <View pointerEvents="none" style={[styles.dividerRow, style]}>
      <View style={[styles.rule, { backgroundColor: tint }]} />
      <Svg width={44} height={10} viewBox="0 0 44 10" opacity={0.8}>
        {/* small — large — small diamonds */}
        <Path d="M8 5 L11 2.6 L14 5 L11 7.4 Z" fill={tint} />
        <Path d="M18 5 L22 1 L26 5 L22 9 Z" fill="none" stroke={tint} strokeWidth={1.2} />
        <Path d="M30 5 L33 2.6 L36 5 L33 7.4 Z" fill={tint} />
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
      <OrnamentDivider style={styles.labelDivider} />
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
