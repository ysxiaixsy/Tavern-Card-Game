/**
 * Pass-the-phone gate. Shown whenever the next required input belongs to the
 * player who is NOT currently looking at the screen, so hands stay hidden.
 * Only public information appears here (round results, gems).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { playerLabel } from '../cardInfo';
import { color, sp } from '../tokens';
import { useAppStore } from '../store';
import { feedback } from '../feedback';
import { Appear } from '../components/anim';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { Text } from '../components/Text';

function Gems({ count }: { count: number }): React.JSX.Element {
  return (
    <View style={styles.gemRow}>
      {Array.from({ length: Math.max(count, 0) }).map((_, i) => (
        <Icon key={i} name="gem" size={12} color={color.sealRedBright} />
      ))}
    </View>
  );
}

export function PrivacyScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const confirmHandoff = useAppStore((s) => s.confirmHandoff);
  if (session === null || session.handoffTo === null) {
    return null;
  }

  const state = session.state;
  const toLabel = playerLabel(state, session.handoffTo);
  const phaseLine =
    state.phase === 'mulligan' ? 'Opening hand — swap up to 2 cards' : `Round ${state.round} of 3`;

  const reveal = (): void => {
    feedback.tap();
    confirmHandoff();
  };

  return (
    <Appear key={session.handoffTo} style={styles.screen}>
      <Text variant="label" tone="dim" caps>
        Hot-seat
      </Text>
      <Text variant="display" tone="ink">
        Pass the Phone
      </Text>
      <Text variant="title" tone="accentBright" style={styles.to}>
        {toLabel}
      </Text>

      {session.notice !== null && (
        <Panel tone="raised" style={styles.notice}>
          <Text variant="body" style={styles.noticeText}>
            {session.notice}
          </Text>
        </Panel>
      )}

      <View style={styles.statusRow}>
        <View style={styles.gemRow}>
          <Text variant="label" tone="dim" caps>
            P1
          </Text>
          <Gems count={state.players.p1.gems} />
          <Text variant="caption" tone="dim">
            ·
          </Text>
          <Text variant="label" tone="dim" caps>
            P2
          </Text>
          <Gems count={state.players.p2.gems} />
        </View>
        <Text variant="caption" tone="dim">
          {phaseLine}
        </Text>
      </View>

      <Button
        label={`I'm ${session.handoffTo === 'p1' ? 'Player 1' : 'Player 2'} — show my cards`}
        onPress={reveal}
        style={styles.button}
      />
      <Text variant="caption" tone="dim" style={styles.smallprint}>
        No peeking. Witchers always know.
      </Text>
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
  to: {
    marginBottom: sp(2),
  },
  notice: {
    padding: sp(3),
    maxWidth: 320,
  },
  noticeText: {
    textAlign: 'center',
    lineHeight: 19,
  },
  statusRow: {
    alignItems: 'center',
    gap: sp(1),
    marginVertical: sp(2),
  },
  gemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
  },
  button: {
    marginTop: sp(4),
  },
  smallprint: {
    marginTop: sp(2),
  },
});
