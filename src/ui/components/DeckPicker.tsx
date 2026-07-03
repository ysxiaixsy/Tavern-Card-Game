/**
 * Shared deck picker: a snap carousel of faction-heraldry deck cards, used by
 * match setup (both seats) and the online lobby. Replaces the per-screen chip
 * rows. Shows faction, leader, and the deck's card mix; the selected card is
 * auto-scrolled into view; ScrollHint marks the overflow. Long-press a deck to
 * browse its full card roster.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import { cardTypeLine, describeCard } from '../cardInfo';
import { factionTheme } from '../theme';
import { border, color, radius, sp } from '../tokens';
import { leaderShortName, type SavedDeck } from '../store';
import { CardView } from './CardView';
import { Icon } from './Icon';
import { TiledSurface } from './Material';
import { ScrollHint, useScrollHint } from './ScrollHint';
import { Sheet } from './Sheets';
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

/** Full card roster of a deck (long-press): leader + every card with its
 * copy count; tap a card for its rules text (graveyard-style inspect). */
function DeckRosterSheet({
  deck,
  onClose,
}: {
  deck: SavedDeck | null;
  onClose: () => void;
}): React.JSX.Element {
  const [inspectId, setInspectId] = useState<string | null>(null);
  useEffect(() => {
    if (deck === null) {
      setInspectId(null);
    }
  }, [deck]);

  const roster = useMemo(() => {
    if (!deck) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const id of deck.cardIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [deck]);

  const inspect = inspectId !== null ? getCardDef(inspectId) : null;
  return (
    <Sheet visible={deck !== null} title={deck?.name ?? ''} onClose={onClose}>
      {inspect !== null && inspectId !== null && (
        <View style={styles.inspect}>
          <Text variant="caption" tone="accent" style={styles.centerText}>
            {inspect.name} — {cardTypeLine(inspect)}
          </Text>
          {describeCard(inspectId).map((line, i) => (
            <Text key={i} variant="body" style={styles.centerText}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {deck !== null && (
        <>
          <View style={styles.leaderRow}>
            <Icon name="crown" size={14} color={color.accent} />
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {leaderShortName(deck.leaderId)}
            </Text>
            <Text variant="caption" tone="dim">
              · {deck.cardIds.length} cards
            </Text>
          </View>
          <View style={styles.rosterGrid}>
            {roster.map(([defId, count]) => (
              <View key={defId} style={styles.rosterEntry}>
                <CardView defId={defId} size="board" onPress={() => setInspectId(defId === inspectId ? null : defId)} />
                <Text variant="caption" tone={count > 1 ? 'accent' : 'dim'}>
                  {count > 1 ? `×${count}` : ' '}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Sheet>
  );
}

export function DeckPicker({ decks, selectedId, onSelect }: Props): React.JSX.Element {
  const { scrollProps, metrics } = useScrollHint();
  const scrollRef = useRef<ScrollView>(null);
  const mixes = useMemo(() => decks.map(deckMix), [decks]);
  const [rosterDeck, setRosterDeck] = useState<SavedDeck | null>(null);

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
              onLongPress={() => setRosterDeck(deck)}
              delayLongPress={250}
              style={[
                styles.card,
                { borderColor: selected ? color.accentBright : theme.frame },
                selected && styles.cardSelected,
              ]}
            >
              <TiledSurface texture="leather" pointerEvents="none" style={StyleSheet.absoluteFill} />
              {selected && <View pointerEvents="none" style={styles.selectedWash} />}
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
      <DeckRosterSheet deck={rosterDeck} onClose={() => setRosterDeck(null)} />
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
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: border.bold,
  },
  selectedWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239,206,134,0.07)', // faint candle-gold lift
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
  inspect: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    paddingBottom: sp(2),
    marginBottom: sp(2),
    gap: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1),
    marginBottom: sp(2),
  },
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
    justifyContent: 'center',
  },
  rosterEntry: {
    alignItems: 'center',
    gap: 1,
  },
});
