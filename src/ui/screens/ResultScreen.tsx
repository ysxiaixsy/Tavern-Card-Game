/**
 * Match over: winner (or draw), the round-by-round score, rematch / home.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playerLabel } from '../cardInfo';
import { palette, sp } from '../theme';
import { useAppStore } from '../store';
import { feedback } from '../feedback';
import { Appear } from '../components/anim';

export function ResultScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const rematch = useAppStore((s) => s.rematch);
  const quitToHome = useAppStore((s) => s.quitToHome);
  const isDraw = session?.state.result?.winner === null;

  useEffect(() => {
    if (session?.state.result) {
      if (isDraw) {
        feedback.warning();
      } else {
        feedback.success();
      }
    }
  }, [session?.state.result, isDraw]);

  if (session === null || session.state.result === null) {
    return null;
  }

  const state = session.state;
  const result = state.result;
  if (result === null) {
    return null;
  }

  return (
    <Appear style={styles.screen}>
      <Text style={styles.eyebrow}>MATCH OVER</Text>
      <Text style={styles.title}>
        {result.winner === null ? 'A draw!' : `${playerLabel(state, result.winner)} wins!`}
      </Text>
      {result.winner === null && (
        <Text style={styles.sub}>Both players ran out of gems at once.</Text>
      )}

      <View style={styles.rounds}>
        {result.rounds.map((r) => (
          <Text key={r.round} style={styles.roundLine}>
            Round {r.round}: {r.totals.p1} – {r.totals.p2}
            {'  '}
            <Text style={styles.roundWinner}>
              {r.winner === null
                ? 'tied'
                : `${r.winner === 'p1' ? 'P1' : 'P2'}${r.tieBrokenByNilfgaard ? ' (NG tiebreak)' : ''}`}
            </Text>
          </Text>
        ))}
        <Text style={styles.gems}>
          Final gems — P1: {result.gems.p1} · P2: {result.gems.p2}
        </Text>
      </View>

      <Pressable style={styles.button} onPress={rematch}>
        <Text style={styles.buttonText}>Rematch (new shuffle)</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.buttonGhost]} onPress={quitToHome}>
        <Text style={styles.buttonGhostText}>Back to the tavern</Text>
      </Pressable>
    </Appear>
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
    color: palette.goldBright,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: palette.textDim,
    fontSize: 13,
  },
  rounds: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: sp(4),
    gap: sp(1),
    marginVertical: sp(4),
    minWidth: 240,
    alignItems: 'center',
  },
  roundLine: {
    color: palette.text,
    fontSize: 14,
  },
  roundWinner: {
    color: palette.gold,
    fontWeight: '700',
  },
  gems: {
    color: palette.textDim,
    fontSize: 12,
    marginTop: sp(1),
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 24,
    paddingVertical: sp(3),
    paddingHorizontal: sp(6),
    minWidth: 240,
    alignItems: 'center',
  },
  buttonText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 14,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonGhostText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
