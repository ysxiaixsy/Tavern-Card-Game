/**
 * Modal sheets: card zoom, graveyard browser, medic revive picker, leader
 * preview/confirm, and the Scoia'tael first-player choice. All bottom-anchored
 * panels over a dimmed backdrop; no animation polish until M5.
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { color } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { getCardDef } from '../../engine/data/cards';
import type {
  CardInstance,
  Move,
  PlayerView,
  ResolveMedicMove,
  UseLeaderMove,
} from '../../engine/types';
import { cardTypeLine, describeCard } from '../cardInfo';
import { palette, rowLabel, sp } from '../theme';
import { CardView } from './CardView';

// ---------------------------------------------------------------------------
// Base sheet
// ---------------------------------------------------------------------------

interface SheetProps {
  visible: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export function Sheet({ visible, title, onClose, children }: SheetProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} disabled={!onClose}>
        <Pressable style={styles.panel} onPress={() => undefined}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{title}</Text>
            {onClose && (
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="close" size={18} color={color.inkDim} />
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: sp(4) }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Card zoom
// ---------------------------------------------------------------------------

export function CardZoomSheet({
  defId,
  onClose,
}: {
  defId: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const def = defId !== null ? getCardDef(defId) : null;
  return (
    <Sheet visible={defId !== null} title={def?.name ?? ''} onClose={onClose}>
      {def !== null && defId !== null && (
        <View style={styles.zoomBody}>
          <CardView defId={defId} size="large" />
          <Text style={styles.typeLine}>{cardTypeLine(def)}</Text>
          {describeCard(defId).map((line, i) => (
            <Text key={i} style={styles.abilityLine}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Graveyard browser (public for both sides)
// ---------------------------------------------------------------------------

export function GraveyardSheet({
  visible,
  title,
  cards,
  onClose,
}: {
  visible: boolean;
  title: string;
  cards: CardInstance[];
  onClose: () => void;
}): React.JSX.Element {
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspect = inspectId !== null ? getCardDef(inspectId) : null;
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {inspect !== null && inspectId !== null && (
        <View style={styles.inspect}>
          <Text style={styles.typeLine}>{inspect.name} — {cardTypeLine(inspect)}</Text>
          {describeCard(inspectId).map((line, i) => (
            <Text key={i} style={styles.abilityLine}>
              {line}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.cardGrid}>
        {cards.map((card) => (
          <CardView
            key={card.instanceId}
            defId={card.defId}
            instanceId={card.instanceId}
            size="hand"
            onPress={() => setInspectId(card.defId === inspectId ? null : card.defId)}
          />
        ))}
        {cards.length === 0 && <Text style={styles.dimText}>Empty — nobody has died here yet.</Text>}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Medic revive picker (cannot be dismissed: the chain must resolve)
// ---------------------------------------------------------------------------

export function MedicSheet({
  view,
  onSubmit,
}: {
  view: PlayerView;
  onSubmit: (move: Move) => void;
}): React.JSX.Element {
  const mine =
    view.pendingChoice?.kind === 'medic_revive' && view.pendingChoice.player === view.player;
  const options = mine
    ? view.legalMoves.filter((m): m is ResolveMedicMove => m.type === 'RESOLVE_MEDIC')
    : [];
  return (
    <Sheet visible={mine} title="Medic — choose a unit to revive">
      <Text style={styles.dimText}>
        The revived unit is played instantly with its full effect.
      </Text>
      <View style={styles.cardGrid}>
        {options.map((move, i) => (
          <View key={i} style={styles.pickEntry}>
            <CardView
              defId={defIdInGraveyard(view, move.targetInstanceId)}
              instanceId={move.targetInstanceId}
              size="hand"
              onPress={() => onSubmit(move)}
            />
            {move.row && <Text style={styles.rowTag}>{rowLabel[move.row]}</Text>}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function defIdInGraveyard(view: PlayerView, instanceId: string): string {
  const card =
    view.you.graveyard.find((c) => c.instanceId === instanceId) ??
    view.opponent.graveyard.find((c) => c.instanceId === instanceId); // steal_from_graveyard targets
  return card ? card.defId : 'neu_decoy'; // unreachable fallback keeps render safe
}

// ---------------------------------------------------------------------------
// Leader preview / activation
// ---------------------------------------------------------------------------

export function LeaderSheet({
  visible,
  view,
  side,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  view: PlayerView;
  side: 'you' | 'opponent';
  onSubmit: (move: Move) => void;
  onClose: () => void;
}): React.JSX.Element {
  const sideView = side === 'you' ? view.you : view.opponent;
  const def = getCardDef(sideView.leader.defId);
  const leaderMoves =
    side === 'you'
      ? view.legalMoves.filter((m): m is UseLeaderMove => m.type === 'USE_LEADER')
      : [];
  const isDiscardDraw = def.leaderAbility === 'discard_draw' && leaderMoves.length > 0;

  // discard_draw picker state: 2 hand cards out, 1 deck card in.
  const [discardSel, setDiscardSel] = useState<string[]>([]);
  const [fetchSel, setFetchSel] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) {
      setDiscardSel([]);
      setFetchSel(null);
    }
  }, [visible]);

  const fetchOptions = isDiscardDraw
    ? [...new Set(leaderMoves.map((m) => m.drawDefId).filter((d): d is string => d !== undefined))]
    : [];
  const discardDrawMove =
    isDiscardDraw && discardSel.length === 2 && fetchSel !== null
      ? leaderMoves.find(
          (m) =>
            m.drawDefId === fetchSel &&
            m.discardInstanceIds !== undefined &&
            m.discardInstanceIds.length === 2 &&
            m.discardInstanceIds.every((id) => discardSel.includes(id)),
        )
      : undefined;

  let status: string | null = null;
  if (sideView.leaderUsed) {
    status = 'Ability already used this match.';
  } else if (side === 'opponent') {
    status = 'Opponent has not used this ability yet.';
  } else if (leaderMoves.length === 0) {
    status = 'Not usable right now (wrong moment or no valid target).';
  }

  return (
    <Sheet visible={visible} title={def.name} onClose={onClose}>
      <View style={styles.zoomBody}>
        <CardView defId={def.id} size="large" dimmed={sideView.leaderUsed} />
        {describeCard(def.id).map((line, i) => (
          <Text key={i} style={styles.abilityLine}>
            {line}
          </Text>
        ))}
        {status !== null && <Text style={styles.dimText}>{status}</Text>}

        {!isDiscardDraw && leaderMoves.length === 1 && leaderMoves[0].targetInstanceId === undefined && (
          <Pressable style={styles.bigButton} onPress={() => onSubmit(leaderMoves[0])}>
            <Text style={styles.bigButtonText}>Use ability (ends your turn)</Text>
          </Pressable>
        )}
        {leaderMoves.length > 0 && leaderMoves[0].targetInstanceId !== undefined && (
          <>
            <Text style={styles.typeLine}>Pick a unit:</Text>
            <View style={styles.cardGrid}>
              {leaderMoves.map((move, i) => (
                <CardView
                  key={i}
                  defId={defIdInGraveyard(view, move.targetInstanceId as string)}
                  instanceId={move.targetInstanceId as string}
                  size="hand"
                  onPress={() => onSubmit(move)}
                />
              ))}
            </View>
          </>
        )}
        {isDiscardDraw && (
          <>
            <Text style={styles.typeLine}>1 · Choose 2 cards to discard ({discardSel.length}/2)</Text>
            <View style={styles.cardGrid}>
              {view.you.hand.map((card) => (
                <CardView
                  key={card.instanceId}
                  defId={card.defId}
                  instanceId={card.instanceId}
                  size="board"
                  selected={discardSel.includes(card.instanceId)}
                  onPress={() =>
                    setDiscardSel((current) =>
                      current.includes(card.instanceId)
                        ? current.filter((id) => id !== card.instanceId)
                        : current.length < 2
                          ? [...current, card.instanceId]
                          : current,
                    )
                  }
                />
              ))}
            </View>
            <Text style={styles.typeLine}>2 · Fetch any card from your deck</Text>
            <View style={styles.cardGrid}>
              {fetchOptions.map((defId) => (
                <CardView
                  key={defId}
                  defId={defId}
                  size="board"
                  selected={fetchSel === defId}
                  onPress={() => setFetchSel(defId === fetchSel ? null : defId)}
                />
              ))}
            </View>
            <Pressable
              style={[styles.bigButton, !discardDrawMove && { opacity: 0.4 }]}
              disabled={!discardDrawMove}
              onPress={() => discardDrawMove && onSubmit(discardDrawMove)}
            >
              <Text style={styles.bigButtonText}>Confirm (ends your turn)</Text>
            </Pressable>
          </>
        )}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Scoia'tael: choose who goes first (unreachable with v1 decks, wired anyway)
// ---------------------------------------------------------------------------

export function ChooseFirstSheet({
  view,
  onSubmit,
}: {
  view: PlayerView;
  onSubmit: (move: Move) => void;
}): React.JSX.Element {
  const mine =
    view.pendingChoice?.kind === 'choose_first_player' && view.pendingChoice.player === view.player;
  return (
    <Sheet visible={mine} title="Scoia'tael — who goes first?">
      <View style={{ gap: sp(2) }}>
        <Pressable
          style={styles.bigButton}
          onPress={() => onSubmit({ type: 'CHOOSE_FIRST_PLAYER', player: view.player, first: view.player })}
        >
          <Text style={styles.bigButtonText}>I go first</Text>
        </Pressable>
        <Pressable
          style={styles.bigButton}
          onPress={() =>
            onSubmit({
              type: 'CHOOSE_FIRST_PLAYER',
              player: view.player,
              first: view.player === 'p1' ? 'p2' : 'p1',
            })
          }
        >
          <Text style={styles.bigButtonText}>Opponent goes first</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: sp(4),
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(2),
  },
  panelTitle: {
    color: palette.goldBright,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  close: {
    color: palette.textDim,
    fontSize: 18,
    paddingLeft: sp(3),
  },
  zoomBody: {
    alignItems: 'center',
    gap: sp(2),
  },
  typeLine: {
    color: palette.gold,
    fontSize: 12,
    textAlign: 'center',
  },
  abilityLine: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  dimText: {
    color: palette.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: sp(1),
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
    justifyContent: 'center',
    paddingTop: sp(2),
  },
  pickEntry: {
    alignItems: 'center',
    gap: 2,
  },
  rowTag: {
    color: palette.gold,
    fontSize: 10,
  },
  inspect: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingBottom: sp(2),
    gap: 2,
  },
  bigButton: {
    backgroundColor: palette.gold,
    borderRadius: 22,
    paddingVertical: sp(3),
    paddingHorizontal: sp(6),
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 220,
  },
  bigButtonText: {
    color: color.inkOnAccent,
    fontWeight: '800',
    fontSize: 14,
  },
});
