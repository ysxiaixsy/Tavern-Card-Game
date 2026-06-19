/**
 * Programmatic card frame (placeholder art by design — see docs/BRIEF.md).
 * Faction-colored frame, strength badge, row icon, ability icons, name text.
 * All styling constants come from theme.ts so real art can slot in later.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import { CARD_ART } from '../cardArt';
import {
  abilityIcon,
  CARD_SIZE,
  factionTheme,
  palette,
  rowIcon,
  specialIcon,
  weatherIcon,
  type CardSizeKind,
} from '../theme';

interface Props {
  defId: string;
  size: CardSizeKind;
  /** Current effective strength (board cards); falls back to printed. */
  effective?: number;
  selected?: boolean;
  /** Valid target glow (decoy targeting, pickers). */
  highlighted?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

function strengthColor(effective: number, printed: number, isHero: boolean): string {
  if (isHero) {
    return palette.goldBright;
  }
  if (effective > printed) {
    return palette.success;
  }
  if (effective < printed) {
    return palette.danger;
  }
  return palette.text;
}

function CardViewInner({
  defId,
  size,
  effective,
  selected,
  highlighted,
  dimmed,
  onPress,
  onLongPress,
}: Props): React.JSX.Element {
  const def = getCardDef(defId);
  const dims = CARD_SIZE[size];
  const faction = factionTheme[def.faction];
  const isHero = def.type === 'hero';
  const isUnit = def.type === 'unit' || isHero;
  const printed = def.strength ?? 0;
  const shown = effective ?? printed;

  let centerGlyph: string | null = null;
  if (def.type === 'weather' && def.weather) {
    centerGlyph = weatherIcon[def.weather];
  } else if (def.type === 'horn') {
    centerGlyph = specialIcon.horn;
  } else if (def.type === 'scorch') {
    centerGlyph = specialIcon.scorch;
  } else if (def.type === 'decoy') {
    centerGlyph = specialIcon.decoy;
  } else if (def.type === 'mardroeme') {
    centerGlyph = specialIcon.mardroeme;
  } else if (def.type === 'leader') {
    centerGlyph = specialIcon.leader;
  }

  const frameColor = highlighted
    ? palette.targetGlow
    : selected
      ? palette.goldBright
      : isHero
        ? palette.gold
        : faction.frame;

  // Real card art (private, gitignored — see cardArt.ts). The art's printed
  // strength is static, so units get a live effective-strength badge overlaid
  // top-left; selection/target state stays on the border.
  const art = CARD_ART[defId];
  if (art) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        disabled={!onPress && !onLongPress}
        style={[
          styles.frame,
          {
            width: dims.width,
            height: dims.height,
            borderColor: frameColor,
            borderWidth: selected || highlighted ? 2.5 : 1.5,
            opacity: dimmed ? 0.4 : 1,
            transform: selected && size === 'hand' ? [{ translateY: -8 }] : [],
          },
        ]}
      >
        <Image source={art} resizeMode="cover" style={StyleSheet.absoluteFill} />
        {isUnit && (
          <View
            style={[
              styles.artBadge,
              {
                width: dims.badge,
                height: dims.badge,
                borderRadius: dims.badge / 2,
                backgroundColor: isHero ? '#3a2d14' : palette.surface,
                borderColor: frameColor,
              },
            ]}
          >
            <Text
              style={{
                color: strengthColor(shown, printed, isHero),
                fontSize: dims.badge * 0.58,
                fontWeight: '700',
              }}
            >
              {shown}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      disabled={!onPress && !onLongPress}
      style={[
        styles.frame,
        {
          width: dims.width,
          height: dims.height,
          borderColor: frameColor,
          borderWidth: selected || highlighted ? 2.5 : 1.5,
          backgroundColor: palette.surfaceRaised,
          opacity: dimmed ? 0.4 : 1,
          transform: selected && size === 'hand' ? [{ translateY: -8 }] : [],
        },
      ]}
    >
      {/* top strip: strength badge or special glyph */}
      <View style={styles.topRow}>
        {isUnit ? (
          <View
            style={[
              styles.badge,
              {
                width: dims.badge,
                height: dims.badge,
                borderRadius: dims.badge / 2,
                backgroundColor: isHero ? '#3a2d14' : palette.surface,
                borderColor: frameColor,
              },
            ]}
          >
            <Text
              style={{
                color: strengthColor(shown, printed, isHero),
                fontSize: dims.badge * 0.58,
                fontWeight: '700',
              }}
            >
              {shown}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: dims.badge * 0.8 }}>{centerGlyph}</Text>
        )}
        {isHero && <Text style={{ fontSize: dims.icon, color: palette.goldBright }}>★</Text>}
      </View>

      {/* faction tint stripe */}
      <View style={[styles.stripe, { backgroundColor: faction.frame }]} />

      {/* bottom: row + abilities, then name */}
      <View style={styles.bottom}>
        <View style={styles.iconRow}>
          <Text style={{ fontSize: dims.icon }}>
            {isUnit && def.row ? (def.row === 'agile' ? abilityIcon.agile : rowIcon[def.row]) : ' '}
          </Text>
          <Text style={{ fontSize: dims.icon }} numberOfLines={1}>
            {def.abilities.map((a) => abilityIcon[a]).join('')}
          </Text>
        </View>
        <Text
          numberOfLines={size === 'large' ? 2 : 1}
          style={{
            color: palette.text,
            fontSize: dims.name,
            textAlign: 'center',
            paddingHorizontal: 2,
            paddingBottom: 2,
          }}
        >
          {def.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 6,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 2,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  artBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stripe: {
    height: 2,
    opacity: 0.7,
  },
  bottom: {},
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
});

export const CardView = React.memo(CardViewInner);
