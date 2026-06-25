/**
 * Match setup: assign a deck (starter or custom) to each seat, pick the AI
 * difficulty when relevant, start the battle.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { border, color, faction as factionTokens, radius, sp } from '../tokens';
import { allDecks, leaderShortName, useAppStore, type SavedDeck } from '../store';
import type { Difficulty } from '../../ai/agent';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';

function DeckChip({
  deck,
  selected,
  onPress,
}: {
  deck: SavedDeck;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = factionTokens[deck.faction];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.deckChip,
        { borderColor: selected ? theme.accent : color.line },
        selected && { backgroundColor: color.surfaceRaised },
      ]}
    >
      <Text variant="bodyStrong" color={selected ? theme.accent : color.ink} numberOfLines={1}>
        {deck.name}
      </Text>
      <View style={styles.deckMeta}>
        <Icon name="crown" size={12} color={color.inkDim} />
        <Text variant="caption" tone="dim" numberOfLines={1}>
          {leaderShortName(deck.leaderId)} · {deck.cardIds.length} cards
        </Text>
      </View>
    </Pressable>
  );
}

function SeatRow({
  label,
  decks,
  selectedId,
  onSelect,
}: {
  label: string;
  decks: SavedDeck[];
  selectedId: string;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.seatBlock}>
      <Text variant="label" tone="dim" caps style={styles.seatLabel}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
        {decks.map((deck) => (
          <DeckChip
            key={deck.id}
            deck={deck}
            selected={deck.id === selectedId}
            onPress={() => onSelect(deck.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function GameSetupScreen(): React.JSX.Element {
  const mode = useAppStore((s) => s.setupMode);
  const customDecks = useAppStore((s) => s.customDecks);
  const startMatch = useAppStore((s) => s.startMatch);
  const goHome = useAppStore((s) => s.goHome);
  const openDecks = useAppStore((s) => s.openDecks);

  const decks = allDecks(customDecks);
  const [p1DeckId, setP1DeckId] = useState('starter_northern_realms');
  const [p2DeckId, setP2DeckId] = useState('starter_monsters');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [error, setError] = useState<string | null>(null);

  const start = (): void => {
    setError(startMatch(p1DeckId, p2DeckId, difficulty));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10} style={styles.headerBtn}>
          <Icon name="back" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Back
          </Text>
        </Pressable>
        <Text variant="title" tone="accentBright">
          {mode === 'ai' ? 'Versus AI' : 'Hot-seat'}
        </Text>
        <Pressable onPress={openDecks} hitSlop={10} style={styles.headerBtn}>
          <Icon name="deck" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Decks
          </Text>
        </Pressable>
      </View>

      <SeatRow
        label={mode === 'ai' ? 'Your deck' : 'Player 1'}
        decks={decks}
        selectedId={p1DeckId}
        onSelect={setP1DeckId}
      />
      <SeatRow
        label={mode === 'ai' ? 'AI deck' : 'Player 2'}
        decks={decks}
        selectedId={p2DeckId}
        onSelect={setP2DeckId}
      />

      {mode === 'ai' && (
        <View style={styles.diffBlock}>
          <Text variant="label" tone="dim" caps style={styles.seatLabel}>
            AI difficulty
          </Text>
          <View style={styles.diffRow}>
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.diffButton, difficulty === d && styles.diffSelected]}
              >
                <Text variant="label" tone={difficulty === d ? 'accentBright' : 'dim'} caps>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {error !== null && (
        <Text variant="caption" color={color.sealRedBright} style={styles.error}>
          {error}
        </Text>
      )}

      <Button
        label="Start Match"
        onPress={start}
        icon={<Icon name="sword" size={18} color={color.inkOnAccent} />}
        style={styles.startButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: color.bg,
  },
  screen: {
    padding: sp(4),
    paddingBottom: sp(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(5),
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
  },
  seatBlock: {
    marginBottom: sp(4),
  },
  seatLabel: {
    marginBottom: sp(1),
  },
  deckRow: {
    gap: sp(2),
    paddingRight: sp(4),
  },
  deckChip: {
    borderWidth: border.frame,
    borderRadius: radius.md,
    paddingVertical: sp(2),
    paddingHorizontal: sp(3),
    minWidth: 170,
    gap: 2,
  },
  deckMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
  },
  diffBlock: {
    marginBottom: sp(4),
  },
  diffRow: {
    flexDirection: 'row',
    gap: sp(2),
  },
  diffButton: {
    flex: 1,
    borderWidth: border.thin,
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  diffSelected: {
    borderColor: color.accentBright,
    backgroundColor: color.surfaceRaised,
  },
  error: {
    textAlign: 'center',
    marginBottom: sp(2),
  },
  startButton: {
    marginTop: sp(2),
  },
});
