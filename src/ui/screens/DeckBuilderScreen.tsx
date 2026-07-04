/**
 * Deck builder. List view: the four immutable starters (duplicate to edit)
 * plus saved custom decks. Editor view: pick faction → leader variant →
 * card counts, with live legality readouts driven by the engine's own
 * validateDeck (single source of truth for the rules).
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CARD_DEFS, getCardDef, leadersOf } from '../../engine/data/cards';
import { STARTER_DECKS } from '../../engine/data/decks';
import {
  MAX_DECK_CARDS,
  MAX_SPECIAL_CARDS,
  MIN_DECK_CARDS,
  MIN_UNIT_CARDS,
  validateDeck,
} from '../../engine/game';
import { GwentError, type CardDef } from '../../engine/types';
import { factionTheme } from '../theme';
import { border, color, radius, sp } from '../tokens';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { TiledSurface } from '../components/Material';
import { SectionLabel } from '../components/Ornament';
import { Text } from '../components/Text';
import {
  allDecks,
  leaderShortName,
  useAppStore,
  type PlayableFaction,
  type SavedDeck,
} from '../store';
import { CardView } from '../components/CardView';
import { CardZoomSheet } from '../components/Sheets';

const FACTIONS = Object.keys(STARTER_DECKS) as PlayableFaction[];

function poolFor(faction: PlayableFaction): { factionCards: CardDef[]; neutralCards: CardDef[] } {
  const eligible = CARD_DEFS.filter(
    (d) => d.type !== 'leader' && (d.maxCopiesPerDeck ?? 1) > 0,
  );
  return {
    factionCards: eligible.filter((d) => d.faction === faction),
    neutralCards: eligible.filter((d) => d.faction === 'neutral'),
  };
}

function countsFrom(cardIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of cardIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function toCardIds(faction: PlayableFaction, counts: Record<string, number>): string[] {
  const { factionCards, neutralCards } = poolFor(faction);
  const ids: string[] = [];
  for (const def of [...factionCards, ...neutralCards]) {
    for (let i = 0; i < (counts[def.id] ?? 0); i++) {
      ids.push(def.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------

export function DeckBuilderScreen(): React.JSX.Element {
  const customDecks = useAppStore((s) => s.customDecks);
  const saveDeck = useAppStore((s) => s.saveDeck);
  const deleteDeck = useAppStore((s) => s.deleteDeck);
  const goHome = useAppStore((s) => s.goHome);

  const [editing, setEditing] = useState<SavedDeck | null>(null);
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);
  // Multi-delete: select mode over the custom-deck list (starters excluded).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (editing !== null) {
    return (
      <DeckEditor
        deck={editing}
        onClose={() => setEditing(null)}
        onSave={(deck) => {
          saveDeck(deck);
          setEditing(null);
        }}
        onDelete={(id) => {
          deleteDeck(id);
          setEditing(null);
        }}
        zoomDefId={zoomDefId}
        setZoomDefId={setZoomDefId}
      />
    );
  }

  const startNew = (): void => {
    setEditing({
      id: `deck-${Date.now().toString(36)}`,
      name: 'New Deck',
      faction: 'northern_realms',
      leaderId: STARTER_DECKS.northern_realms.leaderId,
      cardIds: [...STARTER_DECKS.northern_realms.cardIds],
    });
  };

  const duplicate = (deck: SavedDeck): void => {
    setEditing({
      ...deck,
      id: `deck-${Date.now().toString(36)}`,
      name: `${deck.name} (copy)`,
      cardIds: [...deck.cardIds],
      builtin: false,
    });
  };

  const confirmDeleteOne = (deck: SavedDeck): void => {
    Alert.alert('Delete this deck?', deck.name, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(deck.id) },
    ]);
  };

  const toggleSelected = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exitSelectMode = (): void => {
    setSelecting(false);
    setSelected(new Set());
  };

  const confirmDeleteSelected = (): void => {
    const count = selected.size;
    Alert.alert('Delete selected decks?', `${count} deck(s) will be removed.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: `Delete ${count}`,
        style: 'destructive',
        onPress: () => {
          for (const id of selected) {
            deleteDeck(id);
          }
          exitSelectMode();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10} style={styles.backRow}>
          <Icon name="back" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Home
          </Text>
        </Pressable>
        <Text variant="title" tone="accentBright">
          Deck Builder
        </Text>
        <View style={styles.backRow} />
      </View>

      <Button
        label="New deck"
        onPress={startNew}
        icon={<Icon name="deck" size={16} color={color.inkOnAccent} />}
        style={styles.newButton}
      />

      <View style={styles.sectionHeader}>
        <SectionLabel style={styles.sectionLabel}>Your decks</SectionLabel>
        {customDecks.length > 0 && (
          <Pressable onPress={selecting ? exitSelectMode : () => setSelecting(true)} hitSlop={8}>
            <Text variant="label" tone="accent" caps>
              {selecting ? 'Done' : 'Select'}
            </Text>
          </Pressable>
        )}
      </View>
      {customDecks.length === 0 && (
        <Text variant="caption" tone="dim">
          None yet — duplicate a starter or build from scratch.
        </Text>
      )}
      {customDecks.map((deck) =>
        selecting ? (
          <Pressable
            key={deck.id}
            onPress={() => toggleSelected(deck.id)}
            style={[
              styles.deckRow,
              { borderLeftColor: factionTheme[deck.faction].frame },
              selected.has(deck.id) && styles.deckRowSelected,
            ]}
          >
            <Icon
              name={selected.has(deck.id) ? 'star' : 'deck'}
              size={16}
              color={selected.has(deck.id) ? color.accentBright : color.inkDim}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="bodyStrong"
                color={selected.has(deck.id) ? color.accentBright : factionTheme[deck.faction].accent}
                numberOfLines={1}
              >
                {deck.name}
              </Text>
              <Text variant="caption" tone="dim" numberOfLines={1}>
                {leaderShortName(deck.leaderId)} · {deck.cardIds.length} cards
              </Text>
            </View>
          </Pressable>
        ) : (
          <DeckRow
            key={deck.id}
            deck={deck}
            onEdit={() => setEditing({ ...deck, cardIds: [...deck.cardIds] })}
            onDuplicate={() => duplicate(deck)}
            onDelete={() => confirmDeleteOne(deck)}
          />
        ),
      )}
      {selecting && (
        <Button
          label={selected.size === 0 ? 'Select decks to delete' : `Delete ${selected.size} deck(s)`}
          variant="danger"
          disabled={selected.size === 0}
          onPress={confirmDeleteSelected}
          style={styles.deleteBar}
        />
      )}

      <SectionLabel style={styles.sectionLabel}>Starter decks (templates)</SectionLabel>
      {allDecks([]).map((deck) => (
        <DeckRow key={deck.id} deck={deck} onDuplicate={() => duplicate(deck)} />
      ))}
    </ScrollView>
  );
}

function DeckRow({
  deck,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  deck: SavedDeck;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}): React.JSX.Element {
  const theme = factionTheme[deck.faction];
  return (
    <TiledSurface texture="leather" fallback={color.surface} style={[styles.deckRow, { borderLeftColor: theme.frame }]}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={theme.accent} numberOfLines={1}>
          {deck.name}
        </Text>
        <View style={styles.deckMetaRow}>
          <Icon name="crown" size={12} color={color.inkDim} />
          <Text variant="caption" tone="dim" numberOfLines={1}>
            {leaderShortName(deck.leaderId)} · {deck.cardIds.length} cards
          </Text>
        </View>
      </View>
      {onEdit && <Button label="Edit" variant="ghost" onPress={onEdit} style={styles.rowButton} />}
      <Button label={onEdit ? 'Copy' : 'Duplicate'} variant="ghost" onPress={onDuplicate} style={styles.rowButton} />
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
          <Icon name="close" size={14} color={color.sealRedBright} />
        </Pressable>
      )}
    </TiledSurface>
  );
}

// ---------------------------------------------------------------------------

function DeckEditor({
  deck,
  onClose,
  onSave,
  onDelete,
  zoomDefId,
  setZoomDefId,
}: {
  deck: SavedDeck;
  onClose: () => void;
  onSave: (deck: SavedDeck) => void;
  onDelete: (id: string) => void;
  zoomDefId: string | null;
  setZoomDefId: (id: string | null) => void;
}): React.JSX.Element {
  const isExistingCustom = useAppStore((s) => s.customDecks.some((d) => d.id === deck.id));
  const [name, setName] = useState(deck.name);
  const [faction, setFaction] = useState<PlayableFaction>(deck.faction);
  const [leaderId, setLeaderId] = useState(deck.leaderId);
  const [counts, setCounts] = useState<Record<string, number>>(countsFrom(deck.cardIds));

  const { factionCards, neutralCards } = useMemo(() => poolFor(faction), [faction]);
  const cardIds = useMemo(() => toCardIds(faction, counts), [faction, counts]);

  const total = cardIds.length;
  let units = 0;
  let specials = 0;
  for (const id of cardIds) {
    const def = getCardDef(id);
    if (def.type === 'unit' || def.type === 'hero') {
      units++;
    } else {
      specials++;
    }
  }

  let validationError: string | null = null;
  try {
    validateDeck({ leaderId, cardIds });
  } catch (error) {
    validationError = error instanceof GwentError ? error.message.replace('INVALID_CONFIG: ', '') : 'invalid';
  }

  const switchFaction = (next: PlayableFaction): void => {
    if (next === faction) {
      return;
    }
    setFaction(next);
    setLeaderId(STARTER_DECKS[next].leaderId);
    setCounts(countsFrom([...STARTER_DECKS[next].cardIds]));
  };

  const bump = (defId: string, delta: number): void => {
    setCounts((current) => {
      const max = getCardDef(defId).maxCopiesPerDeck ?? 1;
      const next = Math.max(0, Math.min(max, (current[defId] ?? 0) + delta));
      return { ...current, [defId]: next };
    });
  };

  const confirmDelete = (): void => {
    Alert.alert('Delete this deck?', name, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(deck.id) },
    ]);
  };

  return (
    <View style={styles.scroll}>
      <ScrollView contentContainerStyle={styles.screen} stickyHeaderIndices={[1]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.backRow}>
            <Icon name="back" size={16} color={color.accent} />
            <Text variant="label" tone="accent" caps>
              Decks
            </Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.nameInput}
            placeholder="Deck name"
            placeholderTextColor={color.inkDim}
            maxLength={28}
          />
          {isExistingCustom ? (
            <Pressable onPress={confirmDelete} hitSlop={10} style={styles.backRow}>
              <Text variant="label" color={color.sealRedBright} caps>
                Delete
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backRow} />
          )}
        </View>

        {/* sticky status bar (opaque oak so scrolled content occludes) */}
        <TiledSurface texture="oakDark" fallback={color.bg} style={styles.statusWrap}>
          <TiledSurface texture="leather" fallback={color.surface} style={styles.statusBar}>
            <Stat label="Total" value={total} ok={total >= MIN_DECK_CARDS && total <= MAX_DECK_CARDS} hint={`${MIN_DECK_CARDS}–${MAX_DECK_CARDS}`} />
            <Stat label="Units" value={units} ok={units >= MIN_UNIT_CARDS} hint={`≥${MIN_UNIT_CARDS}`} />
            <Stat label="Specials" value={specials} ok={specials <= MAX_SPECIAL_CARDS} hint={`≤${MAX_SPECIAL_CARDS}`} />
            <Button
              label="Save"
              disabled={validationError !== null}
              onPress={() => onSave({ id: deck.id, name: name.trim() || 'Unnamed deck', faction, leaderId, cardIds })}
              style={styles.saveButton}
            />
          </TiledSurface>
          {validationError !== null && (
            <Text variant="caption" color={color.sealRedBright} style={styles.validation}>
              {validationError}
            </Text>
          )}
        </TiledSurface>

        <SectionLabel style={styles.sectionLabel}>Faction</SectionLabel>
        <View style={styles.factionRow}>
          {FACTIONS.map((f) => {
            const theme = factionTheme[f];
            const selected = f === faction;
            return (
              <Pressable
                key={f}
                onPress={() => switchFaction(f)}
                style={[styles.factionChip, { borderColor: selected ? theme.accent : color.line }, selected && { backgroundColor: color.surfaceRaised }]}
              >
                <Text variant="caption" color={selected ? theme.accent : color.inkDim} caps numberOfLines={1}>
                  {theme.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" tone="dim" style={styles.hint}>
          Switching faction resets the deck to that faction's starter.
        </Text>

        <SectionLabel style={styles.sectionLabel}>Leader (long-press for ability)</SectionLabel>
        <View style={styles.factionRow}>
          {leadersOf(faction).map((leader) => {
            const selected = leader.id === leaderId;
            return (
              <Pressable
                key={leader.id}
                onPress={() => setLeaderId(leader.id)}
                onLongPress={() => setZoomDefId(leader.id)}
                delayLongPress={250}
                style={[styles.leaderChip, { borderColor: selected ? factionTheme[faction].accent : color.line }, selected && { backgroundColor: color.surfaceRaised }]}
              >
                <Text variant="caption" color={selected ? color.ink : color.inkDim} numberOfLines={2} style={styles.center}>
                  {leaderShortName(leader.id)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <CardSection title={`${factionTheme[faction].label} cards`} defs={factionCards} counts={counts} total={total} onBump={bump} onZoom={setZoomDefId} />
        <CardSection title="Neutral cards" defs={neutralCards} counts={counts} total={total} onBump={bump} onZoom={setZoomDefId} />
      </ScrollView>
      <CardZoomSheet defId={zoomDefId} onClose={() => setZoomDefId(null)} />
    </View>
  );
}

function Stat({ label, value, ok, hint }: { label: string; value: number; ok: boolean; hint: string }): React.JSX.Element {
  return (
    <View style={styles.stat}>
      <Text variant="bodyStrong" color={ok ? color.buff : color.sealRedBright}>
        {value}
      </Text>
      <Text variant="caption" tone="dim">
        {label} {hint}
      </Text>
    </View>
  );
}

function CardSection({
  title,
  defs,
  counts,
  total,
  onBump,
  onZoom,
}: {
  title: string;
  defs: CardDef[];
  counts: Record<string, number>;
  total: number;
  onBump: (defId: string, delta: number) => void;
  onZoom: (defId: string) => void;
}): React.JSX.Element {
  return (
    <View>
      <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
      {defs.map((def) => {
        const count = counts[def.id] ?? 0;
        const max = def.maxCopiesPerDeck ?? 1;
        return (
          <View key={def.id} style={styles.cardRow}>
            <CardView defId={def.id} size="board" onLongPress={() => onZoom(def.id)} onPress={() => onZoom(def.id)} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {def.name}
              </Text>
              <Text variant="caption" tone="dim" numberOfLines={1}>
                {def.type === 'hero' ? 'HERO · ' : ''}
                {def.row ? `${def.row} · ` : ''}
                {def.strength !== undefined ? `str ${def.strength} · ` : ''}
                {def.abilities.join(', ') || (def.type === 'unit' ? 'no ability' : def.type)}
              </Text>
            </View>
            <Pressable style={[styles.stepBtn, count === 0 && styles.stepDisabled]} disabled={count === 0} onPress={() => onBump(def.id, -1)} hitSlop={4}>
              <Text variant="bodyStrong" tone="accentBright">
                −
              </Text>
            </Pressable>
            <Text variant="bodyStrong" style={styles.countText}>
              {count}
              {max > 1 ? `/${max}` : ''}
            </Text>
            <Pressable
              style={[styles.stepBtn, (count >= max || total >= MAX_DECK_CARDS) && styles.stepDisabled]}
              disabled={count >= max || total >= MAX_DECK_CARDS}
              onPress={() => onBump(def.id, 1)}
              hitSlop={4}
            >
              <Text variant="bodyStrong" tone="accentBright">
                ＋
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  screen: {
    padding: sp(4),
    paddingBottom: sp(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(3),
    gap: sp(2),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    minWidth: 72,
  },
  center: {
    textAlign: 'center',
  },
  nameInput: {
    flex: 1,
    color: color.ink,
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: border.thin,
    borderColor: color.line,
    paddingVertical: 2,
    textAlign: 'center',
  },
  newButton: {
    marginBottom: sp(4),
  },
  sectionLabel: {
    marginTop: sp(4),
    marginBottom: sp(2),
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderLeftWidth: border.bold,
    padding: sp(3),
    marginBottom: sp(2),
  },
  deckRowSelected: {
    backgroundColor: color.surfaceRaised,
    borderWidth: border.thin,
    borderColor: color.accentBright,
    borderLeftWidth: border.bold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  deleteBar: {
    marginTop: sp(1),
  },
  deleteButton: {
    padding: sp(2),
  },
  deckMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
  },
  rowButton: {
    paddingVertical: sp(1),
    paddingHorizontal: sp(3),
  },
  statusWrap: {
    backgroundColor: color.bg,
    paddingVertical: sp(1),
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: color.line,
    padding: sp(2),
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  saveButton: {
    paddingVertical: sp(2),
    paddingHorizontal: sp(4),
  },
  validation: {
    marginTop: sp(1),
    textAlign: 'center',
  },
  factionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(1),
  },
  factionChip: {
    flexBasis: '23%',
    flexGrow: 1,
    borderWidth: border.frame,
    borderRadius: radius.md,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  leaderChip: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: border.thin,
    borderRadius: radius.md,
    padding: sp(1),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  hint: {
    marginTop: sp(1),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.25,
  },
  countText: {
    minWidth: 30,
    textAlign: 'center',
  },
});
