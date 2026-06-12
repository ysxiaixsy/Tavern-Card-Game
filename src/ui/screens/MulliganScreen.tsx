/**
 * Opening redraw: swap up to 2 of the 10 dealt cards. MulliganView is
 * presentational over a PlayerView (shared by local and online play);
 * MulliganScreen is the store-connected wrapper for hot-seat / vs AI.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getView } from '../../engine/view';
import type { Move, PlayerView } from '../../engine/types';
import { playerLabel } from '../cardInfo';
import { palette, sp } from '../theme';
import { useAppStore } from '../store';
import { CardView } from '../components/CardView';
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
        <Text style={styles.title}>{waitingText}</Text>
        <Text style={styles.subtitle}>The battle begins in a moment.</Text>
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
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Swap up to 2 cards. There is no draw step — these cards must last all three rounds.
      </Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {view.you.hand.map((card) => (
          <View key={card.instanceId} style={styles.cell}>
            <CardView
              defId={card.defId}
              size="hand"
              selected={selected.includes(card.instanceId)}
              onPress={() => toggle(card.instanceId)}
              onLongPress={() => setZoomDefId(card.defId)}
            />
            {selected.includes(card.instanceId) && <Text style={styles.swapTag}>↻ redraw</Text>}
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.buttonGhost]}
          disabled={choicePending}
          onPress={() => submit([])}
        >
          <Text style={styles.buttonGhostText}>Keep hand</Text>
        </Pressable>
        <Pressable
          style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
          disabled={selected.length === 0 || choicePending}
          onPress={() => submit(selected)}
        >
          <Text style={styles.buttonText}>Redraw {selected.length || ''}</Text>
        </Pressable>
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
    backgroundColor: palette.bg,
    paddingTop: sp(4),
  },
  waiting: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.goldBright,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: palette.textDim,
    fontSize: 12,
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
  swapTag: {
    color: palette.goldBright,
    fontSize: 10,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sp(3),
    padding: sp(3),
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 22,
    paddingVertical: sp(3),
    paddingHorizontal: sp(6),
    minWidth: 140,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
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
