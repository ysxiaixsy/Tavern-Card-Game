/**
 * Match over: winner (or draw), the round-by-round score, rematch / home.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { playerLabel } from '../cardInfo';
import { color, sp } from '../tokens';
import { useAppStore } from '../store';
import { feedback } from '../feedback';
import { Appear } from '../components/anim';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { Text } from '../components/Text';

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
      <Text variant="label" tone="dim" caps>
        Match Over
      </Text>
      <Text variant="display" tone="accentBright" style={styles.title}>
        {result.winner === null ? 'A draw' : `${playerLabel(state, result.winner)} wins`}
      </Text>
      {result.winner === null && (
        <Text variant="caption" tone="dim">
          Both players ran out of gems at once.
        </Text>
      )}

      <Panel style={styles.rounds}>
        {result.rounds.map((r) => (
          <Text key={r.round} variant="body">
            Round {r.round}: {r.totals.p1} – {r.totals.p2}
            {'  '}
            <Text variant="bodyStrong" tone="accent">
              {r.winner === null
                ? 'tied'
                : `${r.winner === 'p1' ? 'P1' : 'P2'}${r.tieBrokenByNilfgaard ? ' (NG tiebreak)' : ''}`}
            </Text>
          </Text>
        ))}
        <Text variant="caption" tone="dim" style={styles.gems}>
          Final gems — P1: {result.gems.p1} · P2: {result.gems.p2}
        </Text>
      </Panel>

      <Button label="Rematch — new shuffle" onPress={rematch} style={styles.button} />
      <Button label="Back to the tavern" variant="ghost" onPress={quitToHome} style={styles.button} />
    </Appear>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(6),
    gap: sp(2),
  },
  title: {
    textAlign: 'center',
  },
  rounds: {
    padding: sp(4),
    gap: sp(1),
    marginVertical: sp(4),
    minWidth: 240,
    alignItems: 'center',
  },
  gems: {
    marginTop: sp(1),
  },
  button: {
    minWidth: 240,
  },
});
