/**
 * Shared deck picker: a snap carousel of faction-heraldry deck cards, used by
 * match setup (both seats) and the online lobby. Replaces the per-screen chip
 * rows. Shows faction, leader, and the deck's card mix; the selected card is
 * auto-scrolled into view; ScrollHint marks the overflow.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import { factionTheme } from '../theme';
import { border, color, radius, sp } from '../tokens';
import { leaderShortName, type SavedDeck } from '../store';
import { Icon } from './Icon';
import { ScrollHint, useScrollHint } from './ScrollHint';
import { Text } from './Text';

const CARD_W = 168;
const GAP = sp(2);

interface Props {
  decks: SavedDeck[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function deckMix(deck: SavedDeck): { units: number; specials: number } {
  let units = 0;
  let specials = 0;
  for (const id of deck.cardIds) {
    const def = getCardDef(id);
    if (def.type === 'unit' || def.type === 'hero') {
      units++;
    } else {
      specials++;
    }
  }
  return { units, specials };
}

export function DeckPicker({ decks, selectedId, onSelect }: Props): React.JSX.Element {
  const { scrollProps, metrics } = useScrollHint();
  const scrollRef = useRef<ScrollView>(null);
  const mixes = useMemo(() => decks.map(deckMix), [decks]);

  // Bring the selected deck into view (once layout is known).
  const selectedIndex = Math.max(0, decks.findIndex((d) => d.id === selectedId));
  useEffect(() => {
    const target = selectedIndex * (CARD_W + GAP);
    scrollRef.current?.scrollTo({ x: Math.max(0, target - CARD_W / 2), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        {...scrollProps}
      >
        {decks.map((deck, i) => {
          const theme = factionTheme[deck.faction];
          const selected = deck.id === selectedId;
          const mix = mixes[i];
          return (
            <Pressable
              key={deck.id}
              onPress={() => onSelect(deck.id)}
              style={[
                styles.card,
                { borderColor: selected ? color.accentBright : theme.frame },
                selected && styles.cardSelected,
              ]}
            >
              <Text variant="caption" color={theme.accent} caps numberOfLines={1}>
                {theme.label}
              </Text>
              <Text
                variant="bodyStrong"
                color={selected ? color.accentBright : color.ink}
                numberOfLines={2}
                style={styles.name}
              >
                {deck.name}
              </Text>
              <View style={styles.metaRow}>
                <Icon name="crown" size={12} color={selected ? color.accent : color.inkDim} />
                <Text variant="caption" tone="dim" numberOfLines={1} style={styles.metaText}>
                  {leaderShortName(deck.leaderId)}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Icon name="deck" size={12} color={color.inkDim} />
                <Text variant="caption" tone="dim" numberOfLines={1} style={styles.metaText}>
                  {deck.cardIds.length} cards · {mix.units}u · {mix.specials}s
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollHint metrics={metrics} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: GAP,
    paddingHorizontal: sp(2),
    // Center the cards when they all fit; scroll when they overflow.
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    borderWidth: border.frame,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingVertical: sp(2),
    paddingHorizontal: sp(3),
    gap: 2,
  },
  cardSelected: {
    backgroundColor: color.surfaceRaised,
    borderWidth: border.bold,
  },
  name: {
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
  },
  metaText: {
    flex: 1,
  },
});
