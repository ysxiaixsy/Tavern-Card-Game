/**
 * Pass-the-phone gate. Shown whenever the next required input belongs to the
 * player who is NOT currently looking at the screen, so hands stay hidden.
 * Only public information appears here (round results, gems).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playerLabel } from '../cardInfo';
import { GEM, palette, sp } from '../theme';
import { useAppStore } from '../store';

export function PrivacyScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const confirmHandoff = useAppStore((s) => s.confirmHandoff);
  if (session === null || session.handoffTo === null) {
    return null;
  }

  const state = session.state;
  const toLabel = playerLabel(state, session.handoffTo);
  const phaseLine =
    state.phase === 'mulligan'
      ? 'Opening hand — swap up to 2 cards'
      : `Round ${state.round} of 3`;

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>HOT-SEAT</Text>
      <Text style={styles.title}>Pass the phone</Text>
      <Text style={styles.to}>{toLabel}</Text>

      {session.notice !== null && <Text style={styles.notice}>{session.notice}</Text>}

      <View style={styles.statusRow}>
        <Text style={styles.status}>
          P1 {GEM.repeat(Math.max(state.players.p1.gems, 0))}
          {'  ·  '}
          P2 {GEM.repeat(Math.max(state.players.p2.gems, 0))}
        </Text>
        <Text style={styles.phase}>{phaseLine}</Text>
      </View>

      <Pressable style={styles.button} onPress={confirmHandoff}>
        <Text style={styles.buttonText}>I’m {session.handoffTo === 'p1' ? 'Player 1' : 'Player 2'} — show my cards</Text>
      </Pressable>
      <Text style={styles.smallprint}>No peeking. Witchers always know.</Text>
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
    gap: sp(2),
  },
  eyebrow: {
    color: palette.textDim,
    fontSize: 12,
    letterSpacing: 4,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  to: {
    color: palette.goldBright,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: sp(2),
  },
  notice: {
    color: palette.text,
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: sp(3),
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  statusRow: {
    alignItems: 'center',
    gap: 2,
    marginVertical: sp(2),
  },
  status: {
    color: palette.danger,
    fontSize: 14,
    letterSpacing: 1,
  },
  phase: {
    color: palette.textDim,
    fontSize: 12,
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 24,
    paddingVertical: sp(4),
    paddingHorizontal: sp(6),
    marginTop: sp(4),
  },
  buttonText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 15,
  },
  smallprint: {
    color: palette.textDim,
    fontSize: 11,
    marginTop: sp(2),
  },
});
