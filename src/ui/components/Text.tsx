/**
 * Typed text primitive. `variant` pulls a role from the type scale (Cinzel for
 * display/title/heading/numeral, Spectral for body/label/caption); `tone` picks
 * an ink color. Replaces ad-hoc inline fontSize/fontWeight across screens.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { color, typography } from '../tokens';

export type TextVariant = keyof typeof typography;

type Tone = 'ink' | 'dim' | 'accent' | 'accentBright' | 'onAccent' | 'onParchment';

const TONE: Record<Tone, string> = {
  ink: color.ink,
  dim: color.inkDim,
  accent: color.accent,
  accentBright: color.accentBright,
  onAccent: color.inkOnAccent,
  onParchment: color.inkOnParchment,
};

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: Tone;
  /** Escape hatch for an exact color (faction accents, strength state, …). */
  color?: string;
  /** SMALL-CAPS feel for labels without a true SC font. */
  caps?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'ink',
  color: colorOverride,
  caps,
  style,
  ...rest
}: Props): React.JSX.Element {
  const base: TextStyle = {
    ...typography[variant],
    color: colorOverride ?? TONE[tone],
  };
  return <RNText {...rest} style={[base, caps && CAPS, style]} />;
}

const CAPS: TextStyle = { textTransform: 'uppercase', letterSpacing: 2 };
