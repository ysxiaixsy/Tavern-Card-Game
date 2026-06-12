/**
 * The tavern door — mode selection only. Faction, leader and card choices
 * all live in the deck builder; seat assignments happen on the setup screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, sp } from '../theme';
import { useAppStore } from '../store';

export function HomeScreen(): React.JSX.Element {
  const beginSetup = useAppStore((s) => s.beginSetup);
  const openDecks = useAppStore((s) => s.openDecks);
  const deckCount = useAppStore((s) => s.customDecks.length);

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>THE WITCHER 3 TAVERN GAME</Text>
      <Text style={styles.title}>GWENT</Text>
      <Text style={styles.sub}>best of 3 · 10 cards · no draw step</Text>

      <View style={styles.menu}>
        <Pressable style={styles.button} onPress={() => beginSetup('hotseat')}>
          <Text style={styles.buttonText}>⚔️ Hot-seat — two players, one phone</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => beginSetup('ai')}>
          <Text style={styles.buttonText}>🤖 Versus AI</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonGhost]} onPress={openDecks}>
          <Text style={styles.buttonGhostText}>
            🃏 Deck builder{deckCount > 0 ? `  (${deckCount} custom)` : ''}
          </Text>
        </Pressable>
        <View style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonDisabledText}>🌐 Online (room code) — arrives in M4</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Fan-made, non-commercial. Placeholder art only — no CDPR assets.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(6),
  },
  kicker: {
    color: palette.textDim,
    fontSize: 11,
    letterSpacing: 3,
  },
  title: {
    color: palette.goldBright,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 6,
    marginVertical: sp(1),
  },
  sub: {
    color: palette.textDim,
    fontSize: 12,
    marginBottom: sp(8),
  },
  menu: {
    gap: sp(3),
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 26,
    paddingVertical: sp(4),
    alignItems: 'center',
  },
  buttonText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 15,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.gold,
  },
  buttonGhostText: {
    color: palette.goldBright,
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonDisabledText: {
    color: palette.textDim,
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    color: palette.textDim,
    fontSize: 10,
    position: 'absolute',
    bottom: sp(6),
    textAlign: 'center',
  },
});
