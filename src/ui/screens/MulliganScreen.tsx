/**
 * Opening redraw: swap up to 2 of the 10 dealt cards. MulliganView is
 * presentational over a PlayerView (shared by local and online play);
 * MulliganScreen is the store-connected wrapper for hot-seat / vs AI.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getView } from '../../engine/view';
import type { Move, PlayerView } from '../../engine/types';
import { playerLabel } from '../cardInfo';
import { color, sp } from '../tokens';
import { useAppStore } from '../store';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Text } from '../components/Text';
import { CardZoomSheet, ChooseFirstSheet } from '../components/Sheets';

export interface MulliganViewProps {
  view: PlayerView;
  title: string;
  /** Shown instead of the picker when it is not this player's input. */
  waitingText: string | null;
  onMove: (move: Move) => void;
}

export function MulliganView({ view, title, waitingText, onMove }: MulliganViewProps): React.JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);

  const choicePending = view.pendingChoice !== null;

  if (waitingText !== null) {
    return (
      <View style={[styles.screen, styles.waiting]}>
        <Text variant="title" tone="accentBright" style={styles.center}>
          {waitingText}
        </Text>
        <Text variant="caption" tone="dim">
          The battle begins in a moment.
        </Text>
        <ChooseFirstSheet view={view} onSubmit={onMove} />
      </View>
    );
  }

  const toggle = (instanceId: string): void => {
    setSelected((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < 2
          ? [...current, instanceId]
          : current,
    );
  };

  const submit = (cardInstanceIds: string[]): void => {
    setSelected([]);
    onMove({ type: 'MULLIGAN', player: view.player, cardInstanceIds });
  };

  return (
    <View style={styles.screen}>
      <Text variant="title" tone="accentBright" style={styles.center}>
        {title}
      </Text>
      <Text variant="caption" tone="dim" style={styles.subtitle}>
        Swap up to 2 cards. There is no draw step — these cards must last all three rounds.
      </Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {view.you.hand.map((card) => (
          <View key={card.instanceId} style={styles.cell}>
            <CardView
              defId={card.defId}
              instanceId={card.instanceId}
              size="hand"
              selected={selected.includes(card.instanceId)}
              onPress={() => toggle(card.instanceId)}
              onLongPress={() => setZoomDefId(card.defId)}
            />
            {selected.includes(card.instanceId) && (
              <Text variant="caption" tone="accentBright" caps>
                redraw
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttons}>
        <Button
          label="Keep hand"
          variant="ghost"
          disabled={choicePending}
          onPress={() => submit([])}
          style={styles.button}
        />
        <Button
          label={`Redraw ${selected.length || ''}`.trim()}
          disabled={selected.length === 0 || choicePending}
          onPress={() => submit(selected)}
          style={styles.button}
        />
      </View>

      <CardZoomSheet defId={zoomDefId} onClose={() => setZoomDefId(null)} />
      <ChooseFirstSheet view={view} onSubmit={onMove} />
    </View>
  );
}

/** Store-connected wrapper for hot-seat and vs-AI sessions. */
export function MulliganScreen(): React.JSX.Element | null {
  const session = useAppStore((s) => s.session);
  const dispatchMove = useAppStore((s) => s.dispatchMove);

  const view: PlayerView | null = useMemo(
    () => (session ? getView(session.state, session.viewer) : null),
    [session],
  );
  if (session === null || view === null) {
    return null;
  }

  return (
    <MulliganView
      view={view}
      title={playerLabel(session.state, view.player)}
      waitingText={view.you.mulliganDone ? 'Opponent is choosing their cards…' : null}
      onMove={dispatchMove}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
    paddingTop: sp(4),
  },
  waiting: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1),
  },
  center: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: sp(1),
    marginBottom: sp(3),
    paddingHorizontal: sp(6),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sp(2),
    paddingHorizontal: sp(2),
    paddingBottom: sp(4),
  },
  cell: {
    alignItems: 'center',
    gap: 2,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sp(3),
    padding: sp(3),
  },
  button: {
    minWidth: 140,
  },
});
