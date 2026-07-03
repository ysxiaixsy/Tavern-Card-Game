/**
 * Match setup: assign a deck (starter or custom) to each seat, pick the AI
 * difficulty when relevant, start the battle.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { border, color, radius, sp } from '../tokens';
import {
  allDecks,
  useAppStore,
  type OpponentDeckSpec,
  type PlayableFaction,
  type SavedDeck,
} from '../store';
import { factionTheme } from '../theme';
import type { Difficulty } from '../../ai/agent';
import { Button } from '../components/Button';
import { DeckPicker } from '../components/DeckPicker';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';

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
      {label !== '' && (
        <Text variant="label" tone="dim" caps style={styles.seatLabel}>
          {label}
        </Text>
      )}
      <DeckPicker decks={decks} selectedId={selectedId} onSelect={onSelect} />
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
  // AI opponent deck: an explicit deck, a random pick, or an AI-drafted deck.
  const [aiDeckMode, setAiDeckMode] = useState<'list' | 'random' | 'build'>('list');
  const [aiBuildFaction, setAiBuildFaction] = useState<PlayableFaction | 'surprise'>('surprise');
  const [error, setError] = useState<string | null>(null);

  const start = (): void => {
    let p2: OpponentDeckSpec = p2DeckId;
    if (mode === 'ai' && aiDeckMode === 'random') {
      p2 = { kind: 'random' };
    } else if (mode === 'ai' && aiDeckMode === 'build') {
      p2 = { kind: 'build', faction: aiBuildFaction };
    }
    setError(startMatch(p1DeckId, p2, difficulty));
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
      {mode === 'ai' ? (
        <View style={styles.seatBlock}>
          <Text variant="label" tone="dim" caps style={styles.seatLabel}>
            AI deck
          </Text>
          <View style={styles.diffRow}>
            {(
              [
                { key: 'list', label: 'Choose' },
                { key: 'random', label: 'Random' },
                { key: 'build', label: 'AI drafts' },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setAiDeckMode(opt.key)}
                style={[styles.diffButton, aiDeckMode === opt.key && styles.diffSelected]}
              >
                <Text variant="label" tone={aiDeckMode === opt.key ? 'accentBright' : 'dim'} caps>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {aiDeckMode === 'list' && (
            <SeatRow label="" decks={decks} selectedId={p2DeckId} onSelect={setP2DeckId} />
          )}
          {aiDeckMode === 'random' && (
            <Text variant="caption" tone="dim" style={styles.aiHint}>
              A random faction — stronger difficulties bring that faction's strongest deck.
            </Text>
          )}
          {aiDeckMode === 'build' && (
            <>
              <View style={styles.factionRow}>
                {(
                  [...(Object.keys(factionTheme) as (keyof typeof factionTheme)[])].filter(
                    (f): f is PlayableFaction => f !== 'neutral',
                  ) as PlayableFaction[]
                ).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setAiBuildFaction(f)}
                    style={[
                      styles.factionChip,
                      { borderColor: aiBuildFaction === f ? factionTheme[f].accent : color.line },
                      aiBuildFaction === f && { backgroundColor: color.surfaceRaised },
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={aiBuildFaction === f ? factionTheme[f].accent : color.inkDim}
                      caps
                      numberOfLines={1}
                    >
                      {factionTheme[f].label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setAiBuildFaction('surprise')}
                  style={[
                    styles.factionChip,
                    { borderColor: aiBuildFaction === 'surprise' ? color.accentBright : color.line },
                    aiBuildFaction === 'surprise' && { backgroundColor: color.surfaceRaised },
                  ]}
                >
                  <Text
                    variant="caption"
                    tone={aiBuildFaction === 'surprise' ? 'accentBright' : 'dim'}
                    caps
                    numberOfLines={1}
                  >
                    Surprise me
                  </Text>
                </Pressable>
              </View>
              <Text variant="caption" tone="dim" style={styles.aiHint}>
                The AI drafts its own deck for this match — sharper drafts at higher difficulties.
              </Text>
            </>
          )}
        </View>
      ) : (
        <SeatRow label="Player 2" decks={decks} selectedId={p2DeckId} onSelect={setP2DeckId} />
      )}

      {mode === 'ai' && (
        <View style={styles.diffBlock}>
          <Text variant="label" tone="dim" caps style={styles.seatLabel}>
            AI difficulty
          </Text>
          <View style={styles.diffRow}>
            {(['easy', 'normal', 'hard', 'witcher'] as const).map((d) => (
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
  factionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(1),
    marginTop: sp(2),
  },
  factionChip: {
    flexBasis: '31%',
    flexGrow: 1,
    borderWidth: border.frame,
    borderRadius: radius.md,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  aiHint: {
    marginTop: sp(2),
    textAlign: 'center',
  },
  error: {
    textAlign: 'center',
    marginBottom: sp(2),
  },
  startButton: {
    marginTop: sp(2),
    alignSelf: 'center',
    minWidth: 240,
  },
});
