/**
 * The tavern door. Each seat picks a faction AND one of its leader variants
 * (long-press a leader to read its ability). Mirrors allowed. Online is M4.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCardDef, leadersOf } from '../../engine/data/cards';
import { STARTER_DECKS } from '../../engine/data/decks';
import { factionTheme, palette, sp } from '../theme';
import { useAppStore, type PlayableFaction, type SeatSetup } from '../store';
import { CardZoomSheet } from '../components/Sheets';

const PLAYABLE: readonly PlayableFaction[] = Object.keys(STARTER_DECKS) as PlayableFaction[];

/** "Foltest, King of Temeria" → "King of Temeria" for compact chips. */
function variantName(defId: string): string {
  const name = getCardDef(defId).name;
  const comma = name.indexOf(',');
  return comma === -1 ? name : name.slice(comma + 1).trim();
}

function SeatPicker({
  label,
  seat,
  onChange,
  onInspectLeader,
}: {
  label: string;
  seat: SeatSetup;
  onChange: (seat: SeatSetup) => void;
  onInspectLeader: (defId: string) => void;
}): React.JSX.Element {
  const theme = factionTheme[seat.faction];
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {PLAYABLE.map((faction) => {
          const fTheme = factionTheme[faction];
          const selected = faction === seat.faction;
          return (
            <Pressable
              key={faction}
              onPress={() =>
                onChange({ faction, leaderId: STARTER_DECKS[faction].leaderId })
              }
              style={[
                styles.factionChip,
                { borderColor: selected ? fTheme.accent : palette.line },
                selected && { backgroundColor: palette.surfaceRaised },
              ]}
            >
              <Text
                style={[styles.factionName, { color: selected ? fTheme.accent : palette.textDim }]}
              >
                {fTheme.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.leaderRow}>
        {leadersOf(seat.faction).map((leader) => {
          const selected = leader.id === seat.leaderId;
          return (
            <Pressable
              key={leader.id}
              onPress={() => onChange({ ...seat, leaderId: leader.id })}
              onLongPress={() => onInspectLeader(leader.id)}
              delayLongPress={250}
              style={[
                styles.leaderChip,
                { borderColor: selected ? theme.accent : palette.line },
                selected && { backgroundColor: palette.surfaceRaised },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[styles.leaderName, { color: selected ? palette.text : palette.textDim }]}
              >
                👑 {variantName(leader.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function HomeScreen(): React.JSX.Element {
  const startHotSeat = useAppStore((s) => s.startHotSeat);
  const startVsAi = useAppStore((s) => s.startVsAi);
  const [seat1, setSeat1] = useState<SeatSetup>({
    faction: 'northern_realms',
    leaderId: STARTER_DECKS.northern_realms.leaderId,
  });
  const [seat2, setSeat2] = useState<SeatSetup>({
    faction: 'monsters',
    leaderId: STARTER_DECKS.monsters.leaderId,
  });
  const [zoomDefId, setZoomDefId] = useState<string | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <Text style={styles.kicker}>THE WITCHER 3 TAVERN GAME</Text>
      <Text style={styles.title}>GWENT</Text>
      <Text style={styles.sub}>best of 3 · 10 cards · no draw step · long-press a leader for details</Text>

      <SeatPicker label="PLAYER 1 — YOU" seat={seat1} onChange={setSeat1} onInspectLeader={setZoomDefId} />
      <SeatPicker
        label="PLAYER 2 — FRIEND OR AI"
        seat={seat2}
        onChange={setSeat2}
        onInspectLeader={setZoomDefId}
      />

      <View style={styles.menu}>
        <Pressable style={styles.button} onPress={() => startHotSeat(seat1, seat2)}>
          <Text style={styles.buttonText}>⚔️ Hot-seat — two players, one phone</Text>
        </Pressable>
        <Text style={styles.menuLabel}>🤖 Versus AI (it plays Player 2's side)</Text>
        <View style={styles.difficultyRow}>
          {(['easy', 'normal', 'hard'] as const).map((difficulty) => (
            <Pressable
              key={difficulty}
              style={styles.diffButton}
              onPress={() => startVsAi(difficulty, seat1, seat2)}
            >
              <Text style={styles.diffText}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonDisabledText}>🌐 Online (room code) — arrives in M4</Text>
        </View>
      </View>

      <Text style={styles.footer}>Fan-made, non-commercial. Placeholder art only — no CDPR assets.</Text>

      <CardZoomSheet defId={zoomDefId} onClose={() => setZoomDefId(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  screen: {
    alignItems: 'center',
    padding: sp(5),
    paddingBottom: sp(8),
  },
  kicker: {
    color: palette.textDim,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: sp(4),
  },
  title: {
    color: palette.goldBright,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
  },
  sub: {
    color: palette.textDim,
    fontSize: 11,
    marginBottom: sp(4),
    textAlign: 'center',
  },
  pickerBlock: {
    alignSelf: 'stretch',
    marginBottom: sp(3),
  },
  pickerLabel: {
    color: palette.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: sp(1),
  },
  pickerRow: {
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
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  factionName: {
    fontWeight: '700',
    fontSize: 10,
    textAlign: 'center',
  },
  leaderRow: {
    flexDirection: 'row',
    gap: sp(1),
    marginTop: sp(1),
  },
  leaderChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: sp(1),
    paddingHorizontal: sp(1),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  leaderName: {
    fontSize: 10,
    textAlign: 'center',
  },
  menu: {
    gap: sp(3),
    alignSelf: 'stretch',
    marginTop: sp(2),
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 26,
    paddingVertical: sp(4),
    alignItems: 'center',
  },
  buttonText: {
    color: '#241a12',
    fontWeight: '800',
    fontSize: 15,
  },
  menuLabel: {
    color: palette.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: sp(1),
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: sp(2),
    justifyContent: 'center',
  },
  diffButton: {
    flex: 1,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.gold,
    borderRadius: 22,
    paddingVertical: sp(3),
    alignItems: 'center',
  },
  diffText: {
    color: palette.goldBright,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonDisabledText: {
    color: palette.textDim,
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    color: palette.textDim,
    fontSize: 10,
    marginTop: sp(6),
    textAlign: 'center',
  },
});
