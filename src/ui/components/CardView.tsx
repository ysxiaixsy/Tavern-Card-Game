/**
 * Card frame. Shows real art when present (cover-fit + a live strength badge),
 * else a programmatic frame: faction-colored edge, engraved strength numeral,
 * row + ability icons, name. Styling comes from the design tokens; glyphs are
 * the hand-drawn SVG Icon set (no emoji).
 */

import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import type { Ability, CardDef, UnitRow } from '../../engine/types';
import { CARD_ART } from '../cardArt';
import { TEXTURE } from '../textures';
import { CARD_SIZE, type CardSizeKind } from '../theme';
import { border, color, faction as factionTokens, radius } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props {
  defId: string;
  size: CardSizeKind;
  /** Card instance id — used to pick the per-copy art variant (multi-copy cards). */
  instanceId?: string;
  /** Current effective strength (board cards); falls back to printed. */
  effective?: number;
  selected?: boolean;
  /** Valid target glow (decoy targeting, pickers). */
  highlighted?: boolean;
  dimmed?: boolean;
  /** Strength values show only for cards on the battlefield. */
  onField?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

/** Strength color: hero gold, buffed green-up, weakened red-down, else ink. */
function strengthColor(effective: number, printed: number, isHero: boolean): string {
  if (isHero) {
    return color.accentBright;
  }
  if (effective > printed) {
    return color.buff;
  }
  if (effective < printed) {
    return color.sealRed;
  }
  return color.ink;
}

const ROW_ICON: Record<UnitRow, IconName> = {
  melee: 'sword',
  ranged: 'bow',
  siege: 'tower',
  agile: 'agile',
};

const ABILITY_ICON: Record<Ability, IconName> = {
  spy: 'spy',
  medic: 'medic',
  muster: 'muster',
  bond: 'bond',
  moral: 'moral',
  horn: 'horn',
  agile: 'agile',
  scorch_row: 'scorch',
};

/** Center glyph for non-unit special cards. */
function specialIconName(def: CardDef): IconName | null {
  if (def.type === 'weather' && def.weather) {
    return def.weather; // frost|fog|rain|storm|clear are all IconNames
  }
  if (def.type === 'horn') return 'horn';
  if (def.type === 'scorch') return 'scorch';
  if (def.type === 'decoy') return 'decoy';
  if (def.type === 'mardroeme') return 'mardroeme';
  if (def.type === 'leader') return 'crown';
  return null;
}

/** Copy index encoded in the instanceId (`p1:st_mahakaman#3` → 3), else 0. */
function copyIndexOf(instanceId: string | undefined): number {
  const match = instanceId?.match(/#(\d+)/);
  return match ? Number(match[1]) : 0;
}

function CardViewInner({
  defId,
  size,
  instanceId,
  effective,
  selected,
  highlighted,
  dimmed,
  onField,
  onPress,
  onLongPress,
}: Props): React.JSX.Element {
  const def = getCardDef(defId);
  // If a per-copy art variant fails to load, fall back to the base art so the
  // card never renders blank (reset when the card identity changes).
  const [artFailed, setArtFailed] = useState(false);
  useEffect(() => setArtFailed(false), [defId, instanceId]);
  const dims = CARD_SIZE[size];
  const faction = factionTokens[def.faction];
  const isHero = def.type === 'hero';
  const isUnit = def.type === 'unit' || isHero;
  const printed = def.strength ?? 0;
  const shown = effective ?? printed;

  const frameColor = highlighted
    ? color.targetable
    : selected
      ? color.accentBright
      : isHero
        ? color.accent
        : faction.frame;

  const frameBox = {
    width: dims.width,
    height: dims.height,
    borderColor: frameColor,
    borderWidth: selected || highlighted ? border.bold : border.frame,
    opacity: dimmed ? 0.4 : 1,
    transform: selected && size === 'hand' ? [{ translateY: -8 }] : [],
  };

  // Strength is shown only for cards on the battlefield.
  const badge = isUnit && onField && (
    <View
      style={[
        styles.badge,
        {
          width: dims.badge,
          height: dims.badge,
          borderRadius: dims.badge / 2,
          backgroundColor: isHero ? color.surfaceRaised : color.surface,
          borderColor: frameColor,
        },
      ]}
    >
      <Text
        variant="numeral"
        color={strengthColor(shown, printed, isHero)}
        style={{ fontSize: dims.badge * 0.6 }}
      >
        {shown}
      </Text>
    </View>
  );

  // Real card art: cover-fit image + a live strength badge overlaid top-left.
  const artEntry = CARD_ART[defId];
  const variantArt = Array.isArray(artEntry)
    ? artEntry[copyIndexOf(instanceId) % artEntry.length]
    : artEntry;
  // A variant that fails to load (e.g. an asset the dev bundle hasn't indexed)
  // degrades to the base art instead of a blank card.
  const art = artFailed && Array.isArray(artEntry) ? artEntry[0] : variantArt;
  if (art) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        disabled={!onPress && !onLongPress}
        style={[styles.frame, frameBox]}
      >
        {/* Explicit 100% box: on the New Architecture an Image with only
            absoluteFill falls back to its intrinsic pixel size. */}
        <Image
          source={art}
          resizeMode="cover"
          style={styles.art}
          onError={() => setArtFailed(true)}
        />
        {badge && <View style={styles.artBadge}>{badge}</View>}
      </Pressable>
    );
  }

  const centerGlyph = specialIconName(def);
  const abilities = def.abilities.filter((a) => a in ABILITY_ICON);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      disabled={!onPress && !onLongPress}
      style={[styles.frame, frameBox, { backgroundColor: color.surfaceRaised }]}
    >
      {/* Worn card stock under the programmatic frame. */}
      <Image source={TEXTURE.leather} resizeMode="repeat" style={styles.stock} />
      {/* top strip: strength badge or special glyph, + hero star */}
      <View style={styles.topRow}>
        {isUnit ? (
          badge
        ) : centerGlyph ? (
          <Icon name={centerGlyph} size={dims.badge} color={color.accent} />
        ) : (
          <View />
        )}
        {isHero && <Icon name="star" size={dims.icon} color={color.accentBright} />}
      </View>

      {/* faction tint stripe */}
      <View style={[styles.stripe, { backgroundColor: faction.frame }]} />

      {/* bottom: row + abilities, then name */}
      <View style={styles.bottom}>
        <View style={styles.iconRow}>
          {isUnit && def.row ? (
            <Icon name={ROW_ICON[def.row]} size={dims.icon} color={faction.accent} />
          ) : (
            <View />
          )}
          <View style={styles.abilityRow}>
            {abilities.map((a, i) => (
              <Icon key={i} name={ABILITY_ICON[a]} size={dims.icon} color={color.accentBright} />
            ))}
          </View>
        </View>
        <Text
          variant={size === 'board' ? 'caption' : 'label'}
          numberOfLines={size === 'large' ? 2 : 1}
          style={{ fontSize: dims.name, textAlign: 'center', paddingHorizontal: 2, paddingBottom: 2 }}
        >
          {def.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.sm,
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
    borderWidth: border.thin,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  stock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  artBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
  },
  stripe: {
    height: 2,
    opacity: 0.7,
  },
  bottom: {},
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  abilityRow: {
    flexDirection: 'row',
    gap: 1,
  },
});

export const CardView = React.memo(CardViewInner);
