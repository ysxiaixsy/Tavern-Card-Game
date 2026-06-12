/**
 * Match setup: assign a deck (starter or custom) to each seat, pick the AI
 * difficulty when relevant, start the battle.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { factionTheme, palette, sp } from '../theme';
import {
  allDecks,
  leaderShortName,
  useAppStore,
  type SavedDeck,
} from '../store';
import type { Difficulty } from '../../ai/agent';

function DeckChip({
  deck,
  selected,
  onPress,
}: {
  deck: SavedDeck;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = factionTheme[deck.faction];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.deckChip,
        { borderColor: selected ? theme.accent : palette.line },
        selected && { backgroundColor: palette.surfaceRaised },
      ]}
    >
      <Text style={[styles.deckName, { color: selected ? theme.accent : palette.text }]} numberOfLines={1}>
        {deck.name}
      </Text>
      <Text style={styles.deckMeta} numberOfLines={1}>
        👑 {leaderShortName(deck.leaderId)} · {deck.cardIds.length} cards
      </Text>
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
      <Text style={styles.seatLabel}>{label}</Text>
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
        <Pressable onPress={goHome} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{mode === 'ai' ? 'Versus AI' : 'Hot-seat'}</Text>
        <Pressable onPress={openDecks} hitSlop={10}>
          <Text style={styles.back}>🃏 Decks</Text>
        </Pressable>
      </View>

      <SeatRow
        label={mode === 'ai' ? 'YOUR DECK' : 'PLAYER 1'}
        decks={decks}
        selectedId={p1DeckId}
        onSelect={setP1DeckId}
      />
      <SeatRow
        label={mode === 'ai' ? 'AI DECK' : 'PLAYER 2'}
        decks={decks}
        selectedId={p2DeckId}
        onSelect={setP2DeckId}
      />

      {mode === 'ai' && (
        <View style={styles.diffBlock}>
          <Text style={styles.seatLabel}>AI DIFFICULTY</Text>
          <View style={styles.diffRow}>
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.diffButton, difficulty === d && styles.diffSelected]}
              >
                <Text style={[styles.diffText, difficulty === d && { color: palette.goldBright }]}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.startButton} onPress={start}>
        <Text style={styles.startText}>⚔️ START MATCH</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.bg,
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
  back: {
    color: palette.gold,
    fontSize: 14,
  },
  title: {
    color: palette.goldBright,
    fontSize: 18,
    fontWeight: '800',
  },
  seatBlock: {
    marginBottom: sp(4),
  },
  seatLabel: {
    color: palette.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: sp(1),
  },
  deckRow: {
    gap: sp(2),
    paddingRight: sp(4),
  },
  deckChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: sp(2),
    paddingHorizontal: sp(3),
    minWidth: 170,
    gap: 2,
  },
  deckName: {
    fontWeight: '800',
    fontSize: 13,
  },
  deckMeta: {
    color: palette.textDim,
    fontSize: 11,
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
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  diffSelected: {
    borderColor: palette.goldBright,
    backgroundColor: palette.surfaceRaised,
  },
  diffText: {
    color: palette.textDim,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: palette.danger,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: sp(2),
  },
  startButton: {
    backgroundColor: palette.gold,
    borderRadius: 26,
    paddingVertical: sp(4),
    alignItems: 'center',
    marginTop: sp(2),
  },
  startText: {
    color: '#241a12',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
});
