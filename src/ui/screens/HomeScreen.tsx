/**
 * The tavern door. Hot-seat is live; AI (M3) and online (M4) are signposted.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, sp } from '../theme';
import { useAppStore } from '../store';

export function HomeScreen(): React.JSX.Element {
  const startHotSeat = useAppStore((s) => s.startHotSeat);
  const startVsAi = useAppStore((s) => s.startVsAi);
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>THE WITCHER 3 TAVERN GAME</Text>
      <Text style={styles.title}>GWENT</Text>
      <Text style={styles.sub}>Northern Realms vs Monsters · best of 3 · 10 cards, no draws</Text>

      <View style={styles.menu}>
        <Pressable style={styles.button} onPress={startHotSeat}>
          <Text style={styles.buttonText}>⚔️ Hot-seat — two players, one phone</Text>
        </Pressable>
        <Text style={styles.menuLabel}>🤖 Versus AI — you play Northern Realms</Text>
        <View style={styles.difficultyRow}>
          <Pressable style={styles.diffButton} onPress={() => startVsAi('easy')}>
            <Text style={styles.diffText}>Easy</Text>
          </Pressable>
          <Pressable style={styles.diffButton} onPress={() => startVsAi('normal')}>
            <Text style={styles.diffText}>Normal</Text>
          </Pressable>
          <Pressable style={styles.diffButton} onPress={() => startVsAi('hard')}>
            <Text style={styles.diffText}>Hard</Text>
          </Pressable>
        </View>
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
  menuLabel: {
    color: palette.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: sp(2),
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: sp(2),
    justifyContent: 'center',
  },
  diffButton: {
    flex: 1,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.gold,
    borderRadius: 22,
    paddingVertical: sp(3),
    alignItems: 'center',
  },
  diffText: {
    color: palette.goldBright,
    fontWeight: '700',
    fontSize: 14,
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
