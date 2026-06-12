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
  Text,
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
import { factionTheme, palette, sp } from '../theme';
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <Text style={styles.title}>Deck Builder</Text>
        <Text style={styles.back}> </Text>
      </View>

      <Pressable style={styles.newButton} onPress={startNew}>
        <Text style={styles.newText}>＋ New deck</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>YOUR DECKS</Text>
      {customDecks.length === 0 && (
        <Text style={styles.empty}>None yet — duplicate a starter or build from scratch.</Text>
      )}
      {customDecks.map((deck) => (
        <DeckRow key={deck.id} deck={deck} onEdit={() => setEditing({ ...deck, cardIds: [...deck.cardIds] })} onDuplicate={() => duplicate(deck)} />
      ))}

      <Text style={styles.sectionLabel}>STARTER DECKS (templates)</Text>
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
}: {
  deck: SavedDeck;
  onEdit?: () => void;
  onDuplicate: () => void;
}): React.JSX.Element {
  const theme = factionTheme[deck.faction];
  return (
    <View style={[styles.deckRow, { borderLeftColor: theme.frame }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.deckName, { color: theme.accent }]} numberOfLines={1}>
          {deck.name}
        </Text>
        <Text style={styles.deckMeta} numberOfLines={1}>
          👑 {leaderShortName(deck.leaderId)} · {deck.cardIds.length} cards
        </Text>
      </View>
      {onEdit && (
        <Pressable style={styles.rowButton} onPress={onEdit}>
          <Text style={styles.rowButtonText}>Edit</Text>
        </Pressable>
      )}
      <Pressable style={styles.rowButton} onPress={onDuplicate}>
        <Text style={styles.rowButtonText}>{onEdit ? 'Copy' : 'Duplicate'}</Text>
      </Pressable>
    </View>
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
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.back}>‹ Decks</Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.nameInput}
            placeholder="Deck name"
            placeholderTextColor={palette.textDim}
            maxLength={28}
          />
          {isExistingCustom ? (
            <Pressable onPress={confirmDelete} hitSlop={10}>
              <Text style={[styles.back, { color: palette.danger }]}>Delete</Text>
            </Pressable>
          ) : (
            <Text style={styles.back}> </Text>
          )}
        </View>

        {/* sticky status bar */}
        <View style={styles.statusWrap}>
          <View style={styles.statusBar}>
            <Stat label="Total" value={total} ok={total >= MIN_DECK_CARDS && total <= MAX_DECK_CARDS} hint={`${MIN_DECK_CARDS}–${MAX_DECK_CARDS}`} />
            <Stat label="Units" value={units} ok={units >= MIN_UNIT_CARDS} hint={`≥${MIN_UNIT_CARDS}`} />
            <Stat label="Specials" value={specials} ok={specials <= MAX_SPECIAL_CARDS} hint={`≤${MAX_SPECIAL_CARDS}`} />
            <Pressable
              style={[styles.saveButton, validationError !== null && styles.saveDisabled]}
              disabled={validationError !== null}
              onPress={() => onSave({ id: deck.id, name: name.trim() || 'Unnamed deck', faction, leaderId, cardIds })}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
          {validationError !== null && <Text style={styles.validation}>{validationError}</Text>}
        </View>

        <Text style={styles.sectionLabel}>FACTION</Text>
        <View style={styles.factionRow}>
          {FACTIONS.map((f) => {
            const theme = factionTheme[f];
            const selected = f === faction;
            return (
              <Pressable
                key={f}
                onPress={() => switchFaction(f)}
                style={[styles.factionChip, { borderColor: selected ? theme.accent : palette.line }, selected && { backgroundColor: palette.surfaceRaised }]}
              >
                <Text style={[styles.factionName, { color: selected ? theme.accent : palette.textDim }]}>
                  {theme.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Switching faction resets the deck to that faction's starter.</Text>

        <Text style={styles.sectionLabel}>LEADER (long-press for ability)</Text>
        <View style={styles.factionRow}>
          {leadersOf(faction).map((leader) => {
            const selected = leader.id === leaderId;
            return (
              <Pressable
                key={leader.id}
                onPress={() => setLeaderId(leader.id)}
                onLongPress={() => setZoomDefId(leader.id)}
                delayLongPress={250}
                style={[styles.leaderChip, { borderColor: selected ? factionTheme[faction].accent : palette.line }, selected && { backgroundColor: palette.surfaceRaised }]}
              >
                <Text numberOfLines={2} style={[styles.leaderName, { color: selected ? palette.text : palette.textDim }]}>
                  👑 {leaderShortName(leader.id)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <CardSection title={`${factionTheme[faction].label.toUpperCase()} CARDS`} defs={factionCards} counts={counts} total={total} onBump={bump} onZoom={setZoomDefId} />
        <CardSection title="NEUTRAL CARDS" defs={neutralCards} counts={counts} total={total} onBump={bump} onZoom={setZoomDefId} />
      </ScrollView>
      <CardZoomSheet defId={zoomDefId} onClose={() => setZoomDefId(null)} />
    </View>
  );
}

function Stat({ label, value, ok, hint }: { label: string; value: number; ok: boolean; hint: string }): React.JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: ok ? palette.success : palette.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label} {hint}</Text>
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
      <Text style={styles.sectionLabel}>{title}</Text>
      {defs.map((def) => {
        const count = counts[def.id] ?? 0;
        const max = def.maxCopiesPerDeck ?? 1;
        return (
          <View key={def.id} style={styles.cardRow}>
            <CardView defId={def.id} size="board" onLongPress={() => onZoom(def.id)} onPress={() => onZoom(def.id)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{def.name}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {def.type === 'hero' ? 'HERO · ' : ''}
                {def.row ? `${def.row} · ` : ''}
                {def.strength !== undefined ? `str ${def.strength} · ` : ''}
                {def.abilities.join(', ') || (def.type === 'unit' ? 'no ability' : def.type)}
              </Text>
            </View>
            <Pressable style={[styles.stepBtn, count === 0 && styles.stepDisabled]} disabled={count === 0} onPress={() => onBump(def.id, -1)} hitSlop={4}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.countText}>{count}{max > 1 ? `/${max}` : ''}</Text>
            <Pressable
              style={[styles.stepBtn, (count >= max || total >= MAX_DECK_CARDS) && styles.stepDisabled]}
              disabled={count >= max || total >= MAX_DECK_CARDS}
              onPress={() => onBump(def.id, 1)}
              hitSlop={4}
            >
              <Text style={styles.stepText}>＋</Text>
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
    backgroundColor: palette.bg,
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
  back: {
    color: palette.gold,
    fontSize: 14,
    minWidth: 52,
  },
  title: {
    color: palette.goldBright,
    fontSize: 18,
    fontWeight: '800',
  },
  nameInput: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderColor: palette.line,
    paddingVertical: 2,
    textAlign: 'center',
  },
  newButton: {
    backgroundColor: palette.gold,
    borderRadius: 22,
    paddingVertical: sp(3),
    alignItems: 'center',
    marginBottom: sp(4),
  },
  newText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionLabel: {
    color: palette.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: sp(4),
    marginBottom: sp(2),
  },
  empty: {
    color: palette.textDim,
    fontSize: 12,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: sp(3),
    marginBottom: sp(2),
  },
  deckName: {
    fontWeight: '800',
    fontSize: 14,
  },
  deckMeta: {
    color: palette.textDim,
    fontSize: 11,
  },
  rowButton: {
    borderWidth: 1,
    borderColor: palette.gold,
    borderRadius: 14,
    paddingHorizontal: sp(3),
    paddingVertical: sp(1),
  },
  rowButtonText: {
    color: palette.goldBright,
    fontSize: 12,
    fontWeight: '700',
  },
  statusWrap: {
    backgroundColor: palette.bg,
    paddingVertical: sp(1),
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: sp(2),
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.textDim,
    fontSize: 9,
  },
  saveButton: {
    backgroundColor: palette.gold,
    borderRadius: 16,
    paddingHorizontal: sp(4),
    paddingVertical: sp(2),
  },
  saveDisabled: {
    opacity: 0.35,
  },
  saveText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 13,
  },
  validation: {
    color: palette.danger,
    fontSize: 11,
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
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  factionName: {
    fontWeight: '700',
    fontSize: 10,
    textAlign: 'center',
  },
  leaderChip: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: sp(1),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  leaderName: {
    fontSize: 10,
    textAlign: 'center',
  },
  hint: {
    color: palette.textDim,
    fontSize: 10,
    marginTop: sp(1),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  cardName: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    color: palette.textDim,
    fontSize: 10,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.25,
  },
  stepText: {
    color: palette.goldBright,
    fontSize: 16,
    fontWeight: '800',
  },
  countText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
});
