/**
 * Modal sheets: card zoom, graveyard browser, medic revive picker, leader
 * preview/confirm, the per-pick confirm step, and the Scoia'tael first-player
 * choice. All centered modal cards over a dimmed backdrop.
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { border, color, radius } from '../tokens';
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
import { rowLabel, sp } from '../theme';
import { Button } from './Button';
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
            <Text variant="heading" tone="accentBright" style={styles.title}>
              {title}
            </Text>
            {onClose && (
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="close" size={18} color={color.inkDim} />
              </Pressable>
            )}
          </View>
          {/* flexShrink (not a hard maxHeight) lets the card use the full
              centered panel, so confirm/Play buttons stay visible without a
              hidden scroll region. */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: sp(4) }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Confirm step for card-pick abilities (medic, leader steal/restore, decoy).
// Shows the chosen card enlarged + its rules text, with Confirm / Cancel. The
// underlying Move is only dispatched on confirm, so cancel is always safe.
// ---------------------------------------------------------------------------

export function ConfirmCard({
  defId,
  instanceId,
  rowTag,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  defId: string;
  instanceId?: string;
  rowTag?: string | null;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const def = getCardDef(defId);
  return (
    <View style={styles.zoomBody}>
      <CardView defId={defId} instanceId={instanceId} size="large" selected />
      <Text variant="caption" tone="accent" style={styles.centerText}>
        {def.name} — {cardTypeLine(def)}
      </Text>
      {rowTag != null && <Text variant="caption" tone="accent" style={styles.centerText}>Row: {rowTag}</Text>}
      {describeCard(defId).map((line, i) => (
        <Text key={i} variant="body" style={styles.centerText}>
          {line}
        </Text>
      ))}
      <View style={styles.confirmRow}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label={confirmLabel ?? 'Confirm'} onPress={onConfirm} />
      </View>
    </View>
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
          <Text variant="caption" tone="accent" style={styles.centerText}>{cardTypeLine(def)}</Text>
          {describeCard(defId).map((line, i) => (
            <Text key={i} variant="body" style={styles.centerText}>
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
        <View style={styles.zoomBody}>
          <CardView defId={inspectId} size="large" />
          <Text variant="caption" tone="accent" style={styles.centerText}>{inspect.name} — {cardTypeLine(inspect)}</Text>
          {describeCard(inspectId).map((line, i) => (
            <Text key={i} variant="body" style={styles.centerText}>
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
        {cards.length === 0 && <Text variant="caption" tone="dim" style={styles.centerText}>Empty — nobody has died here yet.</Text>}
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
  // Group by target — an agile unit yields one move per row (melee/ranged).
  const groups = new Map<string, ResolveMedicMove[]>();
  for (const m of options) {
    const arr = groups.get(m.targetInstanceId) ?? [];
    arr.push(m);
    groups.set(m.targetInstanceId, arr);
  }
  const [pick, setPick] = useState<{ targetInstanceId: string; moves: ResolveMedicMove[] } | null>(null);
  useEffect(() => {
    if (!mine) {
      setPick(null);
    }
  }, [mine]);

  return (
    <Sheet visible={mine} title={pick ? 'Confirm revive' : 'Medic — choose a unit to revive'}>
      {pick ? (
        pick.moves.length > 1 ? (
          // Agile unit: let the player choose which row it returns to.
          <View style={styles.zoomBody}>
            <CardView
              defId={defIdInGraveyard(view, pick.targetInstanceId)}
              instanceId={pick.targetInstanceId}
              size="large"
              selected
            />
            <Text variant="caption" tone="accent" style={styles.centerText}>
              Revive to which row?
            </Text>
            <View style={styles.confirmRow}>
              {pick.moves.map((m, i) => (
                <Button
                  key={i}
                  label={m.row ? rowLabel[m.row] : 'Play'}
                  onPress={() => {
                    onSubmit(m);
                    setPick(null);
                  }}
                />
              ))}
            </View>
            <Button label="Cancel" variant="ghost" onPress={() => setPick(null)} />
          </View>
        ) : (
          <ConfirmCard
            defId={defIdInGraveyard(view, pick.targetInstanceId)}
            instanceId={pick.targetInstanceId}
            confirmLabel="Revive"
            onConfirm={() => {
              onSubmit(pick.moves[0]);
              setPick(null);
            }}
            onCancel={() => setPick(null)}
          />
        )
      ) : (
        <>
          <Text variant="caption" tone="dim" style={styles.centerText}>
            The revived unit is played instantly with its full effect.
          </Text>
          <View style={styles.cardGrid}>
            {[...groups.entries()].map(([targetInstanceId, moves]) => (
              <View key={targetInstanceId} style={styles.pickEntry}>
                <CardView
                  defId={defIdInGraveyard(view, targetInstanceId)}
                  instanceId={targetInstanceId}
                  size="hand"
                  onPress={() => setPick({ targetInstanceId, moves })}
                />
                {moves.length > 1 && (
                  <Text variant="caption" tone="accent">
                    agile
                  </Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}
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
  // Targeted-pick confirm step (restore_to_hand / steal_from_graveyard).
  const [pick, setPick] = useState<UseLeaderMove | null>(null);
  // Active leaders require a deliberate "Play" before the ability UI appears.
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (!visible) {
      setDiscardSel([]);
      setFetchSel(null);
      setPick(null);
      setActivated(false);
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
    <Sheet visible={visible} title={pick ? 'Confirm' : activated ? 'Choose a card' : def.name} onClose={onClose}>
      {pick ? (
        <ConfirmCard
          defId={defIdInGraveyard(view, pick.targetInstanceId as string)}
          instanceId={pick.targetInstanceId as string}
          confirmLabel="Take card"
          onConfirm={() => {
            onSubmit(pick);
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      ) : !activated ? (
        // Leader preview + a deliberate Play step before the ability is used.
        <View style={styles.zoomBody}>
          <CardView defId={def.id} size="large" dimmed={sideView.leaderUsed} />
          {describeCard(def.id).map((line, i) => (
            <Text key={i} variant="body" style={styles.centerText}>
              {line}
            </Text>
          ))}
          {status !== null && <Text variant="caption" tone="dim" style={styles.centerText}>{status}</Text>}
          {leaderMoves.length > 0 && (
            <Button
              label="Play"
              onPress={() => {
                // A single no-target ability commits straight away; anything
                // that needs a pick/discard reveals its UI first.
                if (!isDiscardDraw && leaderMoves.length === 1 && leaderMoves[0].targetInstanceId === undefined) {
                  onSubmit(leaderMoves[0]);
                } else {
                  setActivated(true);
                }
              }}
            />
          )}
        </View>
      ) : (
        // Activated: a clean picker (no leader card), like the medic flow.
        <View style={styles.zoomBody}>
          {isDiscardDraw ? (
            <>
              <Text variant="caption" tone="accent" style={styles.centerText}>1 · Choose 2 cards to discard ({discardSel.length}/2)</Text>
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
              <Text variant="caption" tone="accent" style={styles.centerText}>2 · Fetch any card from your deck</Text>
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
              <Button
                label="Confirm (ends your turn)"
                disabled={!discardDrawMove}
                onPress={() => {
                  if (discardDrawMove) {
                    onSubmit(discardDrawMove);
                  }
                }}
              />
            </>
          ) : (
            <>
              <Text variant="caption" tone="dim" style={styles.centerText}>
                {def.leaderAbility === 'steal_from_graveyard'
                  ? 'Take a unit from the enemy graveyard.'
                  : 'Take a unit from your graveyard.'}
              </Text>
              <View style={styles.cardGrid}>
                {leaderMoves.map((move, i) => (
                  <CardView
                    key={i}
                    defId={defIdInGraveyard(view, move.targetInstanceId as string)}
                    instanceId={move.targetInstanceId as string}
                    size="hand"
                    onPress={() => setPick(move)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}
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
        <Button
          label="I go first"
          onPress={() => onSubmit({ type: 'CHOOSE_FIRST_PLAYER', player: view.player, first: view.player })}
        />
        <Button
          label="Opponent goes first"
          variant="ghost"
          onPress={() =>
            onSubmit({
              type: 'CHOOSE_FIRST_PLAYER',
              player: view.player,
              first: view.player === 'p1' ? 'p2' : 'p1',
            })
          }
        />
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    justifyContent: 'center',
    padding: sp(4),
  },
  panel: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: sp(4),
    borderWidth: border.thin,
    borderColor: color.line,
    maxHeight: '90%',
  },
  scrollArea: {
    flexShrink: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(2),
  },
  title: {
    flex: 1,
  },
  zoomBody: {
    alignItems: 'center',
    gap: sp(2),
  },
  centerText: {
    textAlign: 'center',
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
  confirmRow: {
    flexDirection: 'row',
    gap: sp(3),
    marginTop: sp(2),
  },
});
