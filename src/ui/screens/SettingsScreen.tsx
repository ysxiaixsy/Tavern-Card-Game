/**
 * Settings: persisted preferences (animations, haptics, pass confirmation,
 * AI speed) plus deck data management. All state lives in the zustand store
 * and survives restarts via AsyncStorage.
 */

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { palette, sp } from '../theme';
import { feedback } from '../feedback';
import { useAppStore, type AiSpeed, type Prefs } from '../store';
import { Appear } from '../components/anim';

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.line, true: palette.gold }}
        thumbColor={value ? palette.goldBright : palette.textDim}
      />
    </View>
  );
}

const AI_SPEEDS: { key: AiSpeed; label: string }[] = [
  { key: 'fast', label: 'Fast' },
  { key: 'normal', label: 'Normal' },
  { key: 'slow', label: 'Slow' },
];

export function SettingsScreen(): React.JSX.Element {
  const prefs = useAppStore((s) => s.prefs);
  const setPref = useAppStore((s) => s.setPref);
  const goHome = useAppStore((s) => s.goHome);
  const customDeckCount = useAppStore((s) => s.customDecks.length);
  const deleteDeck = useAppStore((s) => s.deleteDeck);
  const customDecks = useAppStore((s) => s.customDecks);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]): void => {
    setPref(key, value);
    feedback.tap(); // confirm the toggle (no-op if haptics just turned off)
  };

  const clearDecks = (): void => {
    Alert.alert('Delete all custom decks?', `${customDeckCount} deck(s) will be removed. Starter decks stay.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => customDecks.forEach((d) => deleteDeck(d.id)),
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.back}> </Text>
      </View>

      <Appear>
        <Text style={styles.sectionLabel}>GAMEPLAY</Text>
        <ToggleRow
          label="Animations"
          hint="Card and screen transitions"
          value={prefs.animations}
          onChange={(v) => set('animations', v)}
        />
        <ToggleRow
          label="Haptic feedback"
          hint="Vibration on plays, passes and round results"
          value={prefs.haptics}
          onChange={(v) => set('haptics', v)}
        />
        <ToggleRow
          label="Confirm before passing"
          hint="Ask before you lock yourself out of the round"
          value={prefs.confirmPass}
          onChange={(v) => set('confirmPass', v)}
        />

        <Text style={styles.sectionLabel}>AI THINKING SPEED</Text>
        <View style={styles.segment}>
          {AI_SPEEDS.map((s) => {
            const selected = prefs.aiSpeed === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => set('aiSpeed', s.key)}
                style={[styles.segmentButton, selected && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, selected && { color: palette.goldBright }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>DATA</Text>
        <Pressable
          style={[styles.dangerButton, customDeckCount === 0 && styles.dangerDisabled]}
          disabled={customDeckCount === 0}
          onPress={clearDecks}
        >
          <Text style={styles.dangerText}>
            {customDeckCount === 0
              ? 'No custom decks saved'
              : `Delete all ${customDeckCount} custom deck(s)`}
          </Text>
        </Pressable>
      </Appear>

      <Text style={styles.footer}>
        GWENT — fan-made recreation of The Witcher 3's tavern game.{'\n'}
        Non-commercial · placeholder art only · no CDPR assets.
      </Text>
    </ScrollView>
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
    marginBottom: sp(4),
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
  sectionLabel: {
    color: palette.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: sp(5),
    marginBottom: sp(1),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  rowText: {
    flex: 1,
    paddingRight: sp(3),
  },
  rowLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    color: palette.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  segment: {
    flexDirection: 'row',
    gap: sp(2),
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  segmentSelected: {
    borderColor: palette.goldBright,
    backgroundColor: palette.surfaceRaised,
  },
  segmentText: {
    color: palette.textDim,
    fontWeight: '700',
    fontSize: 13,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: palette.danger,
    borderRadius: 18,
    paddingVertical: sp(3),
    alignItems: 'center',
  },
  dangerDisabled: {
    borderColor: palette.line,
    opacity: 0.6,
  },
  dangerText: {
    color: palette.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    color: palette.textDim,
    fontSize: 10,
    textAlign: 'center',
    marginTop: sp(8),
    lineHeight: 16,
  },
});
