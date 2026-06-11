/**
 * The tavern door. Pick a faction for each seat (mirrors allowed), then
 * start hot-seat or face the AI. Online (M4) is signposted.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCardDef } from '../../engine/data/cards';
import { STARTER_DECKS } from '../../engine/data/decks';
import { factionTheme, palette, sp } from '../theme';
import { useAppStore, type PlayableFaction } from '../store';

const PLAYABLE: readonly PlayableFaction[] = Object.keys(STARTER_DECKS) as PlayableFaction[];

function FactionPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlayableFaction;
  onChange: (faction: PlayableFaction) => void;
}): React.JSX.Element {
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {PLAYABLE.map((faction) => {
          const theme = factionTheme[faction];
          const selected = faction === value;
          const leaderName = getCardDef(STARTER_DECKS[faction].leaderId).name.split(',')[0];
          return (
            <Pressable
              key={faction}
              onPress={() => onChange(faction)}
              style={[
                styles.factionChip,
                { borderColor: selected ? theme.accent : palette.line },
                selected && { backgroundColor: palette.surfaceRaised },
              ]}
            >
              <Text style={[styles.factionName, { color: selected ? theme.accent : palette.textDim }]}>
                {theme.label}
              </Text>
              <Text style={styles.factionLeader}>👑 {leaderName}</Text>
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
  const [p1Faction, setP1Faction] = useState<PlayableFaction>('northern_realms');
  const [p2Faction, setP2Faction] = useState<PlayableFaction>('monsters');

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>THE WITCHER 3 TAVERN GAME</Text>
      <Text style={styles.title}>GWENT</Text>
      <Text style={styles.sub}>best of 3 · 10 cards · no draw step</Text>

      <FactionPicker label="PLAYER 1 — YOU" value={p1Faction} onChange={setP1Faction} />
      <FactionPicker label="PLAYER 2 — FRIEND OR AI" value={p2Faction} onChange={setP2Faction} />

      <View style={styles.menu}>
        <Pressable style={styles.button} onPress={() => startHotSeat(p1Faction, p2Faction)}>
          <Text style={styles.buttonText}>⚔️ Hot-seat — two players, one phone</Text>
        </Pressable>
        <Text style={styles.menuLabel}>🤖 Versus AI (it plays Player 2's side)</Text>
        <View style={styles.difficultyRow}>
          {(['easy', 'normal', 'hard'] as const).map((difficulty) => (
            <Pressable
              key={difficulty}
              style={styles.diffButton}
              onPress={() => startVsAi(difficulty, p1Faction, p2Faction)}
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

      <Text style={styles.footer}>
        Fan-made, non-commercial. Placeholder art only — no CDPR assets.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(5),
  },
  kicker: {
    color: palette.textDim,
    fontSize: 11,
    letterSpacing: 3,
  },
  title: {
    color: palette.goldBright,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 6,
  },
  sub: {
    color: palette.textDim,
    fontSize: 12,
    marginBottom: sp(5),
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
    gap: sp(2),
  },
  factionChip: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: sp(2),
    alignItems: 'center',
    gap: 2,
  },
  factionName: {
    fontWeight: '800',
    fontSize: 13,
  },
  factionLeader: {
    color: palette.textDim,
    fontSize: 10,
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
    position: 'absolute',
    bottom: sp(4),
    textAlign: 'center',
  },
});
